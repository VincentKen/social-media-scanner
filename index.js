var jsdom = require("jsdom");
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

  var mainProtocol = mainURL.match(protocolRegex)[0];
  var mainDomain = mainURL.match(domainRegex)[1];

  var max = 100;
  var interval = 250;

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
  };

  /**
   * Start scanning
   * @return {void}
   */
  this.start = function () {
    scan(mainURL, function (url, found) {
      console.log("links:", found.links);
      console.log("media:", found.media);
    });
  };

  /**
   * Scan a single URL
   * @param  {string}   url      URL to scan
   * @param  {Function} callback Callback function
   * @return {void}
   */
  var scan = function (url, callback) {

    jsdom.env({
      url: url,
      scripts: ["http://code.jquery.com/jquery.js"],
      done: function (err, window) {
        if (err) {
          on.error({
            message: "Error retrieving page.",
            page: url,
            error: err
          });
          return callback(url, {});
        }

        var $ = window.jQuery;

        $(window.document).ready(function () {
          var values = []; // list of all values to check

          $("[data-href]").each(function () {
            values.push($(this).attr("data-href"));
          });

          $("[href]").each(function () {
            values.push($(this).attr("href"));
          });

          var found_links = [], found_media = [];

          for (var i = 0; i < values.length; i++) {
            var link_domain, link_protocol, link_url;
            link_url = values[i];

            if (!link_url) { continue; }
            link_url = link_url.trim();

            if (found_media.indexOf(link_url) === -1 && isMedium(link_url)) {
              found_media.push(link_url);
            } else {

              if (isValidURL(link_url)) {
                link_protocol = link_url.match(protocolRegex)[0];
                link_domain = link_url.match(domainRegex)[1];

              // check if url is a relative path
              } else if (!/.*\:.*/.test(link_url) && link_url[0] !== "#") {
                link_protocol = mainProtocol;
                link_domain = mainDomain;

                if (link_url[0] !== "/") {
                  link_url = "/" + link_url;
                }

                link_url = link_protocol + "//" + link_domain + link_url;

              } else {
                link_domain = undefined;
                link_protocol = undefined;
              }

              if (mainDomain === link_domain && found_links.indexOf(link_url) === -1) {
                found_links.push(link_url);
              }
            }
          }

          return callback(url, {
            links: found_links,
            media: found_media
          });
        });

      }
    });

  };
}


/**
* Social media scanner
* @class
*/
function SocialMediaScanner () {

  /**
  * Create a scanner
  * @param  {string} url The starting URL of the website to scan
  * @return {Scanner}
  */
  this.scan = function (url) {
    return new Scanner(url);
  };

}

socialMediaScanner = new SocialMediaScanner();

scanner = socialMediaScanner.scan("http://www.isaacpvl.com/");

scanner.start();

module.exports = Scanner;
