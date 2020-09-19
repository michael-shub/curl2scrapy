var curlField = $('#curl');
var scrapyField = $('#scrapy');
var btn = $('#btn');


function getMethod(str){
    let methodRegex = /-X (\w+)/;
    let methodMatch = str.match(methodRegex) ? str.match(methodRegex)[1] : null

    let postRegex = /\s--data(-binary|-raw|-urlencode)? \S/
    let postMatch = str.match(postRegex) ? 'POST' : null
    return methodMatch || postMatch || 'GET'
};

// Create header from string.
function extractHeader(str){
    return str.split(/: (.+)/)
}

// Removing extra flags
function cleanFlags(str){
    let flags = ["-L", "--location", "--request"]
    let regexString = "\\s(" + flags.join("|") + ")\\s*"
    let regex = new RegExp(regexString, "g")
    return str.replaceAll(regex, '')
}

// Create headers object and stringify it.
function getHeaders(str){
    let headersRegex = /(-H|--header) '(.+?)'/g;
    let matches = [];
    let match = headersRegex.exec(str);
    while (match != null) {
        matches.push(match[2]);
        match = headersRegex.exec(str)
    }
    let headersMatch = matches ? matches : []

    return headersMatch.map(extractHeader).reduce(
        function(acc, v){acc[v[0].trim()] = v[1]; return acc}, {});
};

// Extracting URL from curl data.
function getUrl(text){
    let urlRegex = /((http|https|wss).+?)'?(\s|$)/;
    return text.match(urlRegex)[1]
};

// Extracting cookies from headers
function getCookies(str){
    if (str == null){return null};
        return JSON.stringify(
            str.split(';').map(
                function(x){return x.split(/=(.+)/)}).reduce(
                function(acc, v){
                    acc[v[0].trim()] = v[1]; return acc
                }, 
            {}
        ), null, 4)
    }

function getBody(str){
    let bodyRegex = /--data(-binary|-raw|-urlencode)? '(.+?)'/
    let match = str.match(bodyRegex) 
    return match ? match[2] : null
}


function getCurlObject(curlText){
    curlText = cleanFlags(curlText)
    let url = getUrl(curlText);
    let method = getMethod(curlText);
    let body = getBody(curlText);
    let headers = getHeaders(curlText);
    let cookies = headers.Cookie || headers.cookie || null;
    delete headers.Cookie;
    delete headers.cookie;

    return {
        "url": url,
        "method": method,
        "body": body,
        "headers": headers,
        "cookies": cookies
    }
};


// All together.
function curl2scrapy(curlText){
    try {
        let curlObject = getCurlObject(curlText);

        let cookieText = getCookies(curlObject.cookies);
        let headersText = $.isEmptyObject(curlObject.headers) ? null : JSON.stringify(curlObject.headers, null, 4);

        let result = `from scrapy import Request\n`
                    + `\n`
                    + `url = '[[url]]'\n`
                    + (headersText ? '\nheaders = [[headers]]\n' : '')
                    + (cookieText ? '\ncookies = [[cookies]]\n' : '')
                    + (curlObject.body ? `\nbody = '[[body]]'\n` : '')
                    + `\nrequest = Request(\n`
                    + `    url=url,\n`
                    + `    method='[[method]]',\n`
                    + `    dont_filter=True,\n`
                    + (cookieText ? '    cookies=cookies,\n' : '')
                    + (headersText ? '    headers=headers,\n' : '')
                    + (curlObject.body ? '    body=body,\n' : '')
                    + `)\n\n`
                    + `fetch(request)`

        result = result.replace('[[url]]', curlObject.url)
        .replace('[[headers]]', headersText)
        .replace('[[cookies]]', cookieText)
        .replace('[[method]]', curlObject.method)
        .replace('[[body]]', curlObject.body)
        scrapyField.val(result);
        }
    catch (e) {
        scrapyField.val('Something went wrong...' + '\n' + e);
    }
};

// Translate on paste function + callback
// Many thanks to https://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
function handlePaste (e) {
    var clipboardData, pastedData;

    // Get pasted data via clipboard API
    clipboardData = e.clipboardData || window.clipboardData;
    pastedData = clipboardData.getData('Text');

    // Do whatever with pasteddata
    curl2scrapy(pastedData);
}
document.getElementById('curl').addEventListener('paste', handlePaste);

// // Ctrl-Enter pressed
curlField.keydown(function(e) {
  if (e.ctrlKey && e.keyCode == 13) {
    curl2scrapy(curlField.val());
  }
});

// Button click
btn.click(function(e){
    curl2scrapy(curlField.val());
})