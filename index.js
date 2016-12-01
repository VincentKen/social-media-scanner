var jsdom = require("jsdom");
var request = require("request");
var defaultMedia = require("./default_media");

/**
 * Checks if url parameter is a valid URL
 * @param  {string}  url URL to check
 * @return {Boolean}     returns true if valid URL
 */
function isValidURL(url) {
  return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url);
}

/**
 * Check if url is a link to social media
 * @param  {string}   url                      URL to check
 * @param  {Object}   options                  Options object
 * @param  {string[]} options.media            List of social media prefixes (["facebook.com/", "twitter.com/"])
 * @param  {RegExp}   options.customExpression Check if URL is a medium using this customExpression AND the created regular expression
 * @return {Boolean}
 */
function isMedium(url, options) {
  var regexString = "/*.(";
  options = options || {};
  var media = options.media || defaultMedia;
  var customExpression = options.customExpression;

  var i;

  // start creating regex

  for (i = 0; i < media.length; i++) {
    regexString += createRegexPart(media[i]) + "|";
  }

  // remove | from end of string and start a new capture group
  regexString = regexString.slice(0, regexString.length - 1) + ")(.*)";

  var regex = new RegExp(regexString);

  if (customExpression) {
    if (typeof customExpression === "string") {
      customExpression = new RegExp(customExpression);
    }
    return regex.test(url) || customExpression.test(url);
  }
  return regex.test(url);
}

/**
 * Create variations of part for regex (example|.xample|e.ample)
 * @param  {string} part Create regex part from this part
 * @return {string}      Regex part (.art|p.rt|pa.t|par.)
 */
function createRegexPart(part) {
  var specialChars = ["/", "\\", "(", ")", "|", "?", "#", "$", "^", ">", "<", "*", "[", "]", "*"]; // place \ infront of these chars if they are present in part
  var part_copy = "", regex = "", i;

  // words can be separated in different ways
  part = part.split("-").join(".").split(" ").join(".").split("_").join(".");

  // check for special characters
  for (i = 0; i < part.length; i++) {
    if (specialChars.indexOf(part[i]) > -1) {
      part_copy += "\\";
    }
    part_copy += part[i];
  }

  // ignore parts which are to small like fb.com/ or vk.com/
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

function Scanner(url) {
  if (!isValidURL(url)) {
    throw {
      message: "Expected URL with format: (http:|https)//(domain)/(optional path)",
      url: url,
      error: "Invalid URL"
    };
  }

  var mainURL = url;

  var protocolRegex = /http:|https:/;
  var domainRegex = /(?:http:|https:)\/\/(?:w{3}\.|)([^\/]*)/;
  var extensionRegex = /(?:http:|https:)\/\/(?:w{3}\.|)(?:[^\/]*)(?:[^\.]*)(.*)/;
  var rssRegex = /([^\/]\/(?=rss))/;

  var mainProtocol = mainURL.match(protocolRegex)[0];
  var mainDomain = mainURL.match(domainRegex)[1];
  var mainExtension = mainURL.match(extensionRegex)[1];

  var defaultInterval = 250;
  var defaultMax = 100;

  var mediaList = defaultMedia;

  this.max = defaultMax;
  this.interval = defaultInterval;
  this.skipExternalResources = false;

  var _this = this;

  var on = {
    /**
     * This function is called when an exception is thrown
     * @param {Object} error Exception
     */
    error: function (error) {},
    /**
     * This function is called when the scan is done
     * @param {string[]} all_media A list of all links to social media found
     * @param {Object[]} all_pages A list of all scanned pages with properties: key:string, url:string, found.media:string[], found.links:string[]
     */
    done: function (all_media, all_pages) {},
    /**
     * This function is called when the scan of a page is done
     * @param {Object} page Page Object
     * @param {string} page.key
     * @param {string} page.url
     * @param {Object} page.found
     * @param {string[]} page.found.media,
     * @param {string[]} page.found.links
     */
    pageDone: function (page) {},
    /**
     * This function is called at the start of the scan of a page
     * @param {Object} page Page Object
     * @param {string} page.key
     * @param {string} page.url
     * @param {Object} page.found
     * @param {string[]} page.found.media,
     * @param {string[]} page.found.links
     */
    pageStart: function (page) {}
  };

  /**
   * Set events
   * @param  {string}   eventName Name of callback
   * @param  {Function} callback  Callback function
   * @return {void}
   */
  this.on = function (eventName, callback) {
    if (typeof eventName !== "string") {
      throw {error: "Missing parameter: event"};
    }
    if (typeof callback !== "function") {
      throw {error: "Missing parameteer: callback"};
    }
    on[eventName] = callback;

    return _this;
  };

  /**
   * @return {string[]} List of prefixes for social media links
   */
  this.getMedia = function () {
    return mediaList;
  }

  /**
   * @param {(string[]|string)} med List of media or a single medium to be added to the medium list
   */
  this.addMedium = function (med) {
    if (typeof med === "string") {
      mediaList.push(med);
    } else if (typeof med === "object") {
      mediaList = mediaList.concat(med);
    }
  }

  /**
   * @param {(string[]|string)} med List of media or a single medium to be removed from the medium list
   */
  this.removeMedium = function (med) {
    var temp = [];
    var i;

    if (typeof med === "string") {
      for (i = 0; i < mediaList.length; i++) {
        if (med !== mediaList[i]) {
          temp.push(mediaList[i]);
        }
      }
      mediaList = temp;
    } else if (typeof med === "object") {
      for (i = 0; i < mediaList.length; i++) {
        if (med.indexOf(mediaList[i]) === -1) {
          temp.push(mediaList[i]);
        }
      }
      mediaList = temp;
    }
  }

  /**
   * Scan a single URL
   * @param  {Object} page Page object with url property to scan
   * @param  {Function} callback Callback function
   * @param  {number} counter When JSDOM failes the function will try again.
   *                          counter is used to keep track of how many times this function has been called for this url
   *                          dont change the value of counter when calling from outside this function
   * @return {void}
   */
  var scan = function (page, options, callback, counter) {
    counter = counter || 0;
    options = options || {};
    var fetchExternalResources = options.fetchExternalResources || ["script"];
    var processExternalResources = options.processExternalResources || ["script"];
    var skipExternalResources = options.skipExternalResources || false;

    page.found = page.found || {};
    page.found.links = page.found.links || [];
    page.found.media = page.found.media || [];
    jsdom.env({
      url: page.url,
      scripts: ["http://code.jquery.com/jquery.js"],
      features: {
        FetchExternalResources: fetchExternalResources,
        ProcessExternalResources: processExternalResources,
        SkipExternalResources: skipExternalResources
      },
      done: function (err, window) {
        if (err) {
          if (err.code === "ENOTFOUND" && counter < 3) {
            scan(page, options, callback, ++counter);
            if (window && window.close) window.close();
            return;
          }

          on.error({
            message: "Error retrieving page",
            page: page,
            error: err
          });
          callback(page);
          if (window && window.close) window.close();
          return;
        }
        try {
          var $ = window.jQuery;

          $(window.document).ready(function () {
            var values = []; // list of all values to check
            $("[data-href]").each(function () {
              values.push($(this).attr("data-href"));
            });

            $("a").each(function () {
              values.push($(this).attr("href"));
            });



            callback(checkURLs(page, values));
            if (window && window.close) window.close();
            return;
          });
        } catch (e) {
          on.error({
            message: "Error scanning page",
            page: page,
            error: e
          });
          callback(page);
          if (window && window.close) window.close();
          return;
        }
      }
    });
  };

  /**
   * Check list of urls for media links and links with same domain
   * @param {Object}   page Page object
   * @param {string[]} urls List of urls to check
   * @return {Object}        New page object
   */
  var checkURLs = function (page, urls) {
    page.found = page.found || {};
    page.found.media = page.found.media || [];
    page.found.links = page.found.links || [];

    for (var i = 0; i < urls.length; i++) {
      var link_domain, link_protocol, link_extension, link_url;
      link_url = urls[i];

      if (!link_url) { continue; }
      link_url = link_url.trim();

      if (link_url[link_url.length - 1] === "/") {
        link_url = link_url.slice(0, link_url.length - 1);
      }

      if (page.found.media.indexOf(link_url) === -1 && isMedium(link_url, mediaList)) {
        page.found.media.push(link_url);
      } else {
        if (isValidURL(link_url)) {
          link_protocol = link_url.match(protocolRegex)[0];
          link_domain = link_url.match(domainRegex)[1];
          link_extension = link_url.match(extensionRegex)[1];

        // check if url is a path without a domain
        } else if (!/.*\:.*/.test(link_url) && link_url[0] !== "#") {
          link_protocol = mainProtocol;
          link_domain = mainDomain;

          if (link_url[0] !== "/") {
            link_url = "/" + link_url;
          }

          link_url = link_protocol + "//" + link_domain + link_url;

          link_extension = link_url.match(extensionRegex)[1];

        } else {
          link_domain = undefined;
          link_protocol = undefined;
          link_extension = undefined;
        }

        if (mainDomain === link_domain && page.found.links.indexOf(link_url) === -1 && page.found.links.indexOf(link_url) === -1) {
          page.found.links.push(link_url);
        }
      }
    }

    return page;
  };

  var createPage = function (url, key) {
    return {
      url: url,
      key: key,
      found: { media: [], links: [] }
    };
  };

  /**
   * @callback hasAcceptedContentCallback
   * @param {string} url The checked URL
   * @param {boolean} accepted True if content type is supported false otherwise
   * @param {Object} error If accepted is false it could be because of an error which is represented in this object
   */

  /**
   * jsdom crashes when it tries to load xml or other non excepted types
   * @param {string} url URL to check
   * @param {hasAcceptedContentCallback} callback Callback
   */
  this.hasAcceptedContent = function (url, callback) {
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

  /**
   * Start scanning
   */
  this.start = function () {
    var page = createPage(mainURL, 1);
    on.pageStart(page);

    var externalResourcesOptions = {};
    if (_this.skipExternalResources) {
      externalResourcesOptions.fetchExternalResources = [];
      externalResourcesOptions.processExternalResources = [];
      externalResourcesOptions.skipExternalResources = true;
    }

    scan(page, externalResourcesOptions, function (page) {
      on.pageDone(page);
      if (page.found.links.length === 0) {
        on.done([page.found.media], [page]);
        return;
      }

      // list of all scanned pages
      var pages = [page];
      // list of all found links
      var links = [page.url].concat(page.found.links);
      // keep track of all scanned and currently scanned links
      var scannedLinks = {};
      scannedLinks[page.url] = {done: true};
      var lastKey = 1;
      blockedLinks = {};
      var media = page.found.media || [];

      var currentlyScanning = 0; // amount of links currently being scanned

      var i = 1; // entry URL is at index 0

      var doneScanning = function () {
        var link;
        for (link in scannedLinks) {
          if (scannedLinks[link].done === false) {
            return false;
          }
        }
        return true;
      };

      var t;
      var intervalFunction = function () {
        var link = links[i];
        if (currentlyScanning >= 100) {
          // wait with scanning other links
          clearInterval(t);
          return;
        }
        if (Object.keys(scannedLinks).length >= _this.max) {
          clearInterval(t);
          if (doneScanning()) {
            on.done(media, pages);
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
            on.done(media, pages);
          } else {
            i = links.length; // check for a new link ones one of the other links is done scanning
          }
          return;
        }

        i++;

        if (blockedLinks[link]) {
          for (var j = 0; j < links.length; j++) {
            if (!scannedLinks[links[j]] && !blockedLinks[links[j]]) {
              link = links[j];
              i = j + 1;
            }
          }
        }

        scannedLinks[link] = { done: false };
        // jsdom only accepts resources which contain HTML and crashes on other resources like XML
        _this.hasAcceptedContent(link, function (link, accepted, error) {
          if (!accepted || error) {
            delete scannedLinks[link]; // make room for another link
            blockedLinks[link] = true;
            return;
          }

          var page = createPage(link, ++lastKey + "");
          currentlyScanning++;
          on.pageStart(page);

          var externalResourcesOptions = {};
          if (_this.skipExternalResources) {
            externalResourcesOptions.fetchExternalResources = [];
            externalResourcesOptions.processExternalResources = [];
            externalResourcesOptions.skipExternalResources = true;
          }

          scan(page, externalResourcesOptions, function (page) {
            var j;
            for (j = 0; j < page.found.media.length; j++) {
              if (media.indexOf(page.found.media[j]) === -1) {
                media.push(page.found.media[j]);
              }
            }

            for (j = 0; j < page.found.links.length; j++) {
              if (links.indexOf(page.found.links[j]) === -1) {
                links.push(page.found.links[j]);
              }
            }
            on.pageDone(page);
            pages.push(page);

            scannedLinks[page.url].done = true;
            currentlyScanning--;

            var linkAmount = Object.keys(scannedLinks).length;

            if (linkAmount >= _this.max && doneScanning()) {
              clearInterval(t);
              on.done(media, pages);
            } else if (t === undefined) {
              t = setInterval(intervalFunction, _this.interval);
            } else if (doneScanning()) {
              on.done(media, pages);
            }
          });
        });
      };

      t = setInterval(intervalFunction, _this.interval);

    });

  };
}

/**
* Create a scanner
* @param  {string} url The starting URL of the website to scan
* @return {Scanner}
*/
function scan (url) {
  return new Scanner(url);
}

/**
* Social media scanner
*/
var SocialMediaScanner = {
  scan: scan
};

module.exports = SocialMediaScanner;
