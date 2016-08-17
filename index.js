var jsdom = require("jsdom");
var request = require("request");
var default_media = require("./default_media");

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
  var regexString = "/(";
  options = options || {};
  var media = options.media || default_media;
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

/**
 * Scanner class
 * @param {url} url The starting URL of the website to scan
 * @class
 */
function Scanner (url) {

  if (!isValidURL(url)) {
    throw {error: "Invalid URL"};
  }

  var mainURL = url;

  var protocolRegex = /http:|https:/;
  var domainRegex = /(?:http:|https:)\/\/(?:w{3}\.|)([^\/]*)/;
  var extensionRegex = /(?:http:|https:)\/\/(?:w{3}\.|)(?:[^\/]*)(?:[^\.]*)(.*)/;
  var rssRegex = /([^\/]\/(?=rss))/;

  var mainProtocol = mainURL.match(protocolRegex)[0];
  var mainDomain = mainURL.match(domainRegex)[1];
  var mainExtension = mainURL.match(extensionRegex)[1];

  this.max = 100;
  this.interval = 250;

  var _this = this;

  var on = {
    error: function () {},
    done: function () {},
    pageDone: function () {},
    pageStart: function () {}
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
   * @callback hasAcceptedContentCallback
   * @param {string} url The checked URL
   * @param {boolean} accepted True if content type is supported false otherwise
   * @param {Object} error If accepted is false it could be because of an error which is represented in this object
   */

  /**
   * jsdom crashes when it try to load xml or other non excepted types
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
   * @return {void}
   */
  this.start = function () {
    on.pageStart(mainURL);
    scan(mainURL, function (url, found) {
      on.pageDone(mainURL);
      var i, links = [url].concat(found.links), scanned_links = {};

      // save scanned and currently scanning links in scanned_links with true or false showing if they are done scanning
      scanned_links[url] = true;

      // all links without a combatible content-type and all links which could not be loaded will get property true
      blocked_links = {};

      var media = found.media || []; // a collection of all found social media links

      i = 1; // main URL is at index 0

      /**
       * Check if all links are done scanning
       * @return {Boolean}
       */
      var doneScanning = function () {
        var link;
        for (link in scanned_links) {
          if (scanned_links[link] === false) {
            return false;
          }
        }
        return true;
      };

      // start scanning the found links
      var t = setInterval(function () {
        var link = links[i];

        if (Object.keys(scanned_links).length >= _this.max) {
          clearInterval(t);

          if (doneScanning()) {
            on.done(media);
          }
          return;
        }

        if (scanned_links[link] !== undefined && link !== undefined) { // link is scanning or has already been scanned
          while (scanned_links[link] !== undefined) { // look for unscanned link
            i++;
            link = links[i];
            if (link === undefined) { // at end of array
              i = links.length; // reset i to the end of the links array and wait for next interval
              return;
            }
          }
        }

        // if there is no link to scan check if another link is still scanning
        if (!link) {
          if (doneScanning()) {
            clearInterval(t);
            on.done(media);
          } else {
            i = 0; // check for new links in the next interval
          }
          return;
        }

        i++;

        if (blocked_links[link]) {
          return;
        }
        scanned_links[link] = false;

        _this.hasAcceptedContent(link, function (link, accepted, error) {
          if (!accepted || error) {
            delete scanned_links[link];
            blocked_links[link] = true;
            return;
          }

          on.pageStart(link);

          scan(link, function (url, found) {
            var j;
            for (j = 0; j < found.media.length; j++) {
              if (media.indexOf(found.media[j]) === -1) {
                media.push(found.media[j]);
              }
            }

            for (j = 0; j < found.links.length; j++) {
              if (links.indexOf(found.links[j]) === -1) {
                links.push(found.links[j]);
              }
            }

            i = 1;
            on.pageDone(url, found.media);
            scanned_links[url] = true;

            if (Object.keys(scanned_links).length >= _this.max && doneScanning()) {
              clearInterval(t);
              on.done(media);
            }
          });
        });

      }, _this.interval);
    });
  };

  /**
   * Scan a single URL
   * @param  {string}   url      URL to scan
   * @param  {Function} callback Callback function
   * @return {void}
   */
  var scan = function (url, callback) {
    var t = new Date().getTime();
    jsdom.env({
      url: url,
      scripts: ["http://code.jquery.com/jquery.js"],
      features: {
        FetchExternalResources: ["script"],
        ProcessExternalResources: ["script"],
        SkipExternalResources: false
      },
      done: function (err, window) {
        if (err) {
          on.error({
            message: "Error retrieving page",
            page: url,
            error: err
          });
          return callback(url, {
            links: [],
            media: []
          });
        }
        var $ = window.jQuery;

        $(window.document).ready(function () {
          var values = []; // list of all values to check

          $("[data-href]").each(function () {
            values.push($(this).attr("data-href"));
          });

          $("a").each(function () {
            values.push($(this).attr("href"));
          });

          checkURLs(values, function (found) {
            return callback(url, found);
          });
        });
      }
    });
  };

  /**
   * @callback checkURLsCallback
   * @param {Object} found
   * @param {string[]} found.links Found links with the same domain as the main domain
   * @param {string[]} found.media Found links pointing to social media
   */

  /**
   * Check list of urls for media links and links with same domain
   * @param {string[]} urls List of urls to check
   * @param {checkURLsCallback} callback
   */
  var checkURLs = function (urls, callback) {
    var found_links = [], found_media = [];

    for (var i = 0; i < urls.length; i++) {
      var link_domain, link_protocol, link_extension, link_url;
      link_url = urls[i];

      if (!link_url) { continue; }
      link_url = link_url.trim();

      if (found_media.indexOf(link_url) === -1 && isMedium(link_url)) {
        found_media.push(link_url);
      } else {

        if (isValidURL(link_url)) {
          link_protocol = link_url.match(protocolRegex)[0];
          link_domain = link_url.match(domainRegex)[1];
          link_extension = link_url.match(extensionRegex)[1];

          // check if url is a relative path
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

        if (mainDomain === link_domain && found_links.indexOf(link_url) === -1 && found_links.indexOf(link_url) === -1) {
          found_links.push(link_url);
        }
      }
    }

    return callback({
      media: found_media,
      links: found_links
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
