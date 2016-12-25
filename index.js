"use strict";

const jsdom = require("jsdom");
const request = require("request");
const defaultMedia = require("./default_media");

/**
 * Checks if url parameter is a valid URL
 * @param  {string}  url URL to check
 * @return {Boolean}     returns true if valid URL
 */
function isValidURL(url) {
  return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url);
}

/**
 * Create a regular expression from a list of media
 * @param  {string[]} media list of social media prefixes
 * @return {RegExp}       Regular expression with social media
 */
function createMediumRegex(media) {
  let regexString = "/*(";

  for (let medium of media) {
    regexString += createRegexPart(medium) + "|";
  }

  // remove | from end of string and start a new capture group
  regexString = regexString.slice(0, regexString.length - 1) + ")(.*)";

  return new RegExp(regexString);
}

/**
 * Create variations of part for regex (example|.xample|e.ample)
 * @param  {string} part Create regex part from this part
 * @return {string}      Regex part (.art|p.rt|pa.t|par.)
 */
function createRegexPart(part) {
  let specialChars = ["/", "\\", "(", ")", "|", "?", "#", "$", "^", ">", "<", "*", "[", "]", "*"]; // place \ infront of these chars if they are present in part
  let part_copy = "", regex = "", i;

  // words can be separated in different ways
  part = part.replace(/[-\s_]/g, ".");

  // check for special characters
  for (i = 0; i < part.length; i++) {
    if (specialChars.indexOf(part[i]) > -1) {
      part_copy += "\\";
    }
    part_copy += part[i];
  }

  // ignore parts which are too small like fb.com/ or vk.com/
  if (part.split(".").length === 2 && part.split(".")[0].length <= 3) {
    return part_copy;
  }

  // start creating regexPart
  for (i = 0; i < part_copy.length; i++) {
    // each loop will move the . one step further in part_copy and add it to regex
    // at the and regex will look like this .art|p.rt|pa.t|par.|

    // check if this character escapes a special character
    if (part_copy[i] === "\\" && specialChars.indexOf(part_copy[i + 1]) > -1) {
      regex +=
        part_copy.slice(0, i) +
        "." +
        part_copy.slice(i + 2);

    } else if (specialChars.indexOf(part_copy[i]) > -1 && part_copy[i - 1] === "\\") {
      continue;
    } else {
      regex +=
        part_copy.slice(0, i) +
        "." +
        part_copy.slice(i + 1);

    }

    regex += "|";
  }

  return regex.slice(0, regex.length - 1); // remove | from end of string
}

function getProtocol(url) {
  return url.match(/http:|https:/)[0];
}

function getDomain(url) {
  return url.match(/(?:http:|https:)\/\/(?:w{3}\.|)([^\/]*)/)[1];
}

function getExtension(url) {
  return url.match(/(?:http:|https:)\/\/(?:w{3}\.|)(?:[^\/]*)(?:[^\.]*)(.*)/)[1];
}

function Scanner(url) {
  if (!isValidURL(url)) {
    throw {
      message: "Expected URL with format: (http:|https)//(domain)/(optional path)",
      url: url,
      error: "Invalid URL"
    };
  }

  const _mainURL = url;

  const _mainProtocol = getProtocol(_mainURL);
  const _mainDomain = getDomain(_mainURL);
  const _mainExtension = getExtension(_mainURL);

  const _defaultInterval = 250;
  const _defaultMax = 100;

  let _useWindowClose = true;
  let _mediaList = defaultMedia;
  let _blockedURLs = [];

  this.max = _defaultMax;
  this.interval = _defaultInterval;
  this.skipExternalResources = false;

  let _on = {
    /**
     * This function is called when an exception is thrown
     * @return {Object} Exception
     */
    error: () => {},
    /**
     * This function is called when the scan is done
     * @param {string[]} all_media A list of all links to social media found
     * @param {Object[]} all_pages A list of all scanned pages with properties: key:string, url:string, found.media:string[], found.links:string[]
     */
    done: () => {},
    /**
     * This function is called when the scan of a page is done
     * @param {Object} page Page Object
     * @param {string} page.key
     * @param {string} page.url
     * @param {Object} page.found
     * @param {string[]} page.found.media
     * @param {string[]} page.found.links
     */
    pageDone: () => {},
    /**
     * This function is called at the start of the scan of a page
     * @param {Object} page Page Object
     * @param {string} page.key
     * @param {string} page.url
     * @param {Object} page.found
     * @param {string[]} page.found.media
     * @param {string[]} page.found.links
     * @param {Function} skip
     */
    pageStart: () => {}
  };

  /**
   * Set events
   * @param  {string}   eventName Name of callback
   * @param  {Function} callback  Callback function
   */
  this.on = (eventName, callback) => {
    if (typeof eventName !== "string") {
      throw {error: "Missing parameter: event"};
    }
    if (typeof callback !== "function") {
      throw {error: "Missing parameteer: callback"};
    }
    _on[eventName] = callback;
  };

  /**
   * @return {string[]} List of prefixes for social media links
   */
  this.getMedia = () => _mediaList;

  /**
   * @param {(string[]|string)} med List of media or a single medium to be added to the medium list
   */
  this.addMedium = (med) => {
    if (typeof med === "string") {
      _mediaList.push(med);
    } else if (typeof med === "object") {
      _mediaList = _mediaList.concat(med);
    }
  };

  /**
   * @param {(string[]|string)} med List of media or a single medium to be removed from the medium list
   */
  this.removeMedium = (med) => {
    let temp = [];
    let i;

    if (typeof med === "string") {
      for (i = 0; i < _mediaList.length; i++) {
        if (med !== _mediaList[i]) {
          temp.push(_mediaList[i]);
        }
      }
      _mediaList = temp;
    } else if (typeof med === "object") {
      for (i = 0; i < _mediaList.length; i++) {
        if (med.indexOf(_mediaList[i]) === -1) {
          temp.push(_mediaList[i]);
        }
      }
      _mediaList = temp;
    }
  };

  /**
   * Add URL to list of URLs which shouldn't be scanned
   * @param {string} url URL to block
   */
  this.blockURL = (url) => {
    _blockedURLs.push(url);
  };

  const isBlockedURL = (url) => {
    const regexResult = /(?:http:\/\/|https:\/\/).*(\/(.*))/.exec(url); // get path from link to check in blockedURLs

    if (!regexResult) {
      return _blockedURLs.indexOf(url);
    }

    return !(
      _blockedURLs.indexOf(url) === -1 &&
      _blockedURLs.indexOf(regexResult[1]) === -1 &&
      _blockedURLs.indexOf(regexResult[2]) === -1
    );
  };

  /**
   * jsdom crashes when it tries to load xml or other non excepted types
   * @param  {string}   url      URL to check
   * @param  {Function} callback true if the response has content-type text/html, false otherwise
   */
  this.hasAcceptedContent = (url, callback) => {
    request.head(url, function (err, response, body) {
      if (err || response.statusCode !== 200) {
        return callback(url, false, err);
      }

      var type = response.headers["content-type"];

      if (type && type.indexOf("text/html") > -1) {
        return callback(url, true);
      } else {
        return callback(url, false);
      }
    });
  };

  const getPageProperties = (page) => {
    return {
      url: page.url,
      key: page.key,
      found: page.found
    };
  };

  this.start = () => {
    const page = new Page(_mainURL, 1);

    _on.pageStart(getPageProperties(page), () => {});

    if (this.skipExternalResources) {
      page.fetchExternalResources = [];
      page.processExternalResources = [];
      page.skipExternalResources = true;
    }

    page.scan(_mediaList, (err) => {
      if (err) {
        _on.error(Object.assign({}, err, { page: getPageProperties(page) }));
        return;
      }

      if (page.found.links.length === 0) {
        _on.done(page.found.media, [getPageProperties(page)]);
        return;
      }

      // list of all scanned pages
      let pages = [getPageProperties(page)];
      // list of all found links
      let links = [page.url];

      for (let link of page.found.links) {
        if (!isBlockedURL(link)) {
          links.push(link);
        }
      }

      // keep track of all scanned and currently scanned links
      let scannedLinks = {};
      scannedLinks[page.url] = {done: true};
      let lastKey = 1;
      let localBlockedURLs = {};
      let media = page.found.media || [];

      let currentlyScanning = 0; // amount of links currently being scanned

      let i = 1; // entry URL is at index 0

      let doneScanning = () => {
        for (let link in scannedLinks) {
          if (scannedLinks[link].done === false) {
            return false;
          }
        }
        return true;
      };

      let t;
      const intervalFunction = () => {
        let link = links[i];

        if (currentlyScanning >= 10) {
          // wait with scanning other links
          clearInterval(t);
          return;
        }

        if (Object.keys(scannedLinks).length >= this.max) {
          clearInterval(t);
          if (doneScanning()) {
            _on.done(media, pages);
          }
          return;
        }

        // check if link is already beeing scanned
        if (scannedLinks[link] !== undefined && link !== undefined) {
          // search for unscanned link
          while (scannedLinks[link] !== undefined) {
            i++;
            link = links[i];
            if (link === undefined) { // at end of array
              clearInterval(t); // wait for a link to scan before checking for new links
              return;
            }
          }
        }

        // if there is no link to scan check if another link is still scanning
        if (!link) {
          clearInterval(t);
          if (doneScanning()) {
            _on.done(media, pages);
          } else {
            i = links.length; // check for a new link ones one of the other links is done scanning
          }
          return;
        }

        i++;

        if (localBlockedURLs[link]) {
          for (let j = 0; j < links.length; j++) {
            if (!scannedLinks[links[j]] && !localBlockedURLs[links[j]]) {
              link = links[j];
              i = j + 1;
            }
          }
        }

        scannedLinks[link] = { done: false };
        // jsdom only accepts resources which contain HTML and crashes on other resources like XML
        this.hasAcceptedContent(link, (link, accepted, error) => {
          if (!accepted || error) {
            delete scannedLinks[link]; // make room for another link
            localBlockedURLs[link] = true;
            return;
          }

          let page = new Page(link, ++lastKey);

          let skip = false;
          const skipURL = () => {
            skip = true;
          };

          _on.pageStart(page, skipURL);

          if (skip) {
            delete scannedLinks[link];
            localBlockedURLs[link] = true;
            return;
          }

          currentlyScanning++;

          if (this.skipExternalResources) {
            page.fetchExternalResources = [];
            page.processExternalResources = [];
            page.skipExternalResources = true;
          }

          page.scan(_mediaList, (err) => {
            if (err) {
              _on.error(Object.assign({}, err, { page: getPageProperties(page) }));
            }

            for (let medium of page.found.media) {
              if (media.indexOf(medium) === -1) {
                media.push(medium);
              }
            }

            for (let link of page.found.links) {
              if (links.indexOf(link) === -1 && !isBlockedURL(link)) {
                links.push(link);
              }
            }

            _on.pageDone(getPageProperties(page));
            pages.push(getPageProperties(page));

            scannedLinks[page.url].done = true;
            currentlyScanning--;

            let linkAmount = Object.keys(scannedLinks).length;

            if (linkAmount >= this.max && doneScanning()) {
              clearInterval(t);
              _on.done(media, pages);
            } else if (t === undefined) {
              t = setInterval(intervalFunction, this.interval);
            } else if (doneScanning()) {
              _on.done(media, pages);
            }
          });
        });
      };

      t = setInterval(intervalFunction, this.interval);
    });
  };
}

function Page(url, key) {
  this.url = url;
  this.key = key;

  this.found = { media: [], links: [] };

  const _pageExtension = getExtension(url);
  const _pageDomain = getDomain(url);
  const _pageProtocol = getProtocol(url);

  this.fetchExternalResources = ["script"];
  this.processExternalResources = ["script"];
  this.skipExternalResources = false;

  /**
  * Check list of urls for media links and links with same domain
  * @param {string[]} urls List of urls to check
  * @param {string[]} mediaList List of media to compare urls with
  * @return {Object}        New page object
  */
  const checkURLs = (urls, mediaList) => {
    this.found = this.found || {};
    this.found.media = this.found.media || [];
    this.found.links = this.found.links || [];

    const regex = createMediumRegex(mediaList);

    for (let linkURL of urls) {
      let linkDomain, linkProtocol, linkExtension;

      if (!linkURL) { continue; }
      linkURL = linkURL.trim();

      if (linkURL[linkURL.length - 1] === "/") {
        linkURL = linkURL.slice(0, linkURL.length - 1);
      }

      if (this.found.media.indexOf(linkURL) === -1 && regex.test(linkURL)) {
        this.found.media.push(linkURL);
      } else {
        // check if link links to another page of the same website
        if (isValidURL(linkURL)) {
          linkProtocol = getProtocol(linkURL);
          linkDomain = getDomain(linkURL);
          linkExtension = getExtension(linkURL);

          // check if url is a path without a domain
        } else if (!/.*\:.*/.test(linkURL) && linkURL[0] !== "#") {
          linkProtocol = _pageProtocol;
          linkDomain = _pageDomain;

          if (linkURL[0] !== "/") {
            linkURL = "/" + linkURL;
          }

          linkURL = linkProtocol + "//" + linkDomain + linkURL;

          linkExtension = getExtension(linkURL);

        } else {
          linkDomain = undefined;
          linkProtocol = undefined;
          linkExtension = undefined;
        }

        if (
          _pageDomain === linkDomain &&
          this.found.links.indexOf(linkURL) === -1 &&
          this.found.links.indexOf(linkURL) === -1
        ) {
          this.found.links.push(linkURL);
        }
      }
    }
  };

  let _counter = 0;

  this.resetCounter = () => _counter = 0;

  /**
   * scan page for media and other URLs
   * @param  {string[]} mediaList List of media to scan for
   * @param  {Function} callback  Callback function with error as first parameter
   */
  const scan = (mediaList, callback) => {
    jsdom.env({
      url: this.url,
      scripts: ["http://code.jquery.com/jquery.js"],
      features: {
        FetchExternalResources: this.fetchExternalResources,
        ProcessExternalResources: this.processExternalResources,
        SkipExternalResources: this.skipExternalResources
      },
      done: function (err, window) {
        if (err) {
          // try loading page 3 times before returning an error
          if (err.code === "ENOTFOUND" && _counter < 3) {
            this.scan(callback, ++_counter);
            if (window && window.close) window.close();
            return;
          }

          callback({
            message: "Error retrieving page",
            error: err
          });

          if (window && window.close) window.close();
          return;
        }
        try {
          const $ = window.jQuery;

          $(window.document).ready(function () {
            let values = []; // list of all values to check

            $("[data-href]").each(function () {
              const attr = $(this).attr("data-href");
              if (typeof attr === "string" && values.indexOf(attr) === -1) {
                values.push(attr);
              }
            });

            $("a").each(function () {
              const attr = $(this).attr("href");
              if (typeof attr === "string" && values.indexOf(attr) === -1) {
                values.push(attr);
              }
            });

            checkURLs(values, mediaList);
            callback(undefined);

            if (window && window.close) {
              window.close();
            }
            return;
          });
        } catch (e) {
          callback({
            message: "Error scanning page",
            error: e
          });

          if (window && window.close) {
            window.close();
          }
          return;
        }
      }
    });
  };
  this.scan = scan;
}

module.exports = {
  scan: (url) => new Scanner(url)
};
