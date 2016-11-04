# social-media-scanner

Scan websites for links to social media

## Support
---

Social Media Scanner supports the following links:
- Facebook
- Google +
- Twitter
- Linkedin
- Instagram
- Pinterest
- Reddit
- Tumblr
- VK

## Installation
---

 You can install Social Media Scanner through npm
 > npm install --save social-media-scanner

## Usage
---

### Setup
Start by requiring the node module
```javascript
var socialMediaScanner = require("social-media-scanner");
```

Then you can start scanning a website using `.scan(url);`. This will create a new scanner object for this website.
```javascript
var site1 = socialMediaScanner.scan("http://example.com");
```

### Events
Social Media Scanner has four events: pageStart, pageDone, done and error.  
You can set callbacks for these events with:
```javascript
site1.on("error", function (err) {});
```

#### pageStart
This event is called at the start of a scan of a page.  
The callback for this event has one page object parameter.  
The page object has the following properties:
 - `url`: The url of the page which just started scanning
 - `key`: A unique key for this page
 - `found`: an object with a list of all found links (`links: string[]`) and a list of all found media(`media: string[]`).
page.found.media and page.found.links are just empty arrays at the start of the scan

```javascript
site1.on("pageStart", function (page) {
  console.log("Started scanning: " + page.url);
});
```

#### pageDone
This event returns the same object as above except for page.found.media and page.found.links which now hold values

```javascript
site1.on("pageDone", function (page) {
  console.log("Done scanning: " + page.url);
  console.log("Found media: " + page.found.media);
  console.log("Found links: " + page.found.links);
});
```

#### done
This event fires at the end of the scan and returns a list of all media found and all scanned pages

```javascript
site1.on("done", function (media, pages) {
  console.log("Found: " + media); // Shows a string array with all found media
  console.log("Scanned pages: " + pages); // each page has the same structure as the pages in the previous events
});
```

#### error
This event fires everytime the scanner encounters an error.

```javascript
site1.on("error", function (err) {
  console.log(err);
});
```

### Properties
A scanner has 3 properties:
 - `max`: The max amount of pages to search through (default: 100).
 - `interval`: The amount of milliseconds between each page scan (default: 250).
 - `skipExternalResources`: 
    Social Media Scanner loads external javascript files because some websites get their content from scripts (for example: React websites).  
    Default: false
```javascript
// skipExternalResources example
site1.on("pageStart", function (page) {
  if (page.url === "http://example.com/a-specific/path") {
    site1.skipExternalResources = false;
  } else {
    site1.skipExternalResources = true;
  }
});
```

### Starting the scan
After everything is setup you can start the scan with:
```javascript
site1.start();
```
