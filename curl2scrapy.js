const curlField = $('#curl');
const scrapyField = $('#scrapy');
const format = $("#format");
const btn = $('#btn');


function normaliseNewlines(multilineCurl) {
    return multilineCurl.replace(" \\\n", " ");
}
const curlParser = new ArgumentParser({
    description: 'Basic arg parser for curl command'
});
curlParser.add_argument('command')
curlParser.add_argument('url')
curlParser.add_argument('-d', '--data')
curlParser.add_argument('-b', '--data-binary', '--data-raw', { default: null })
curlParser.add_argument('-X', { default: '' })
curlParser.add_argument('-H', '--header', { action: 'append', default: [] })
curlParser.add_argument('--compressed', { action: 'store_true' })
curlParser.add_argument('-k','--insecure', { action: 'store_true' })
curlParser.add_argument('--user', '-u', { default: [] })
curlParser.add_argument('-i','--include', { action: 'store_true' })
curlParser.add_argument('-s','--silent', { action: 'store_true' })

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

function isForm(headers) {
    let contentType = headers.Content-Type || headers.content-type;
    if (contentType === 'application/x-www-form-urlencoded') {
        return true;
    } return false;
}


function getCurlObject(curlText){
    let method = "get";
    let tokens = shlex.split(normaliseNewlines(curlText));
    let parsedArgs = curlParser.parse_args(tokens);
    let postData = parsedArgs.data || parsedArgs.data_binary;
    if (postData) {
        method = "post";
    }

    let headers = parsedArgs.header.map(extractHeader).reduce(
        function(acc, v){acc[v[0].trim()] = v[1]; return acc}, {});
    let cookies = headers.Cookie || headers.cookie || null;
    delete headers.Cookie;
    delete headers.cookie;

    let isForm = isForm(headers);

    let url = getUrl(curlText);
    let method = getMethod(curlText);
    let headers = getHeaders(curlText);

    return {
        "url": url,
        "method": method,
        "data": postData,
        "isForm": isForm,
        "headers": headers,
        "cookies": cookies
    }
};


// All together.
function curl2scrapy(curlText){
    try {
        let curlObject = getCurlObject(curlText);

        let cookieText = curlObject.cookies;
        let headersText = $.isEmptyObject(curlObject.headers) ? null : JSON.stringify(curlObject.headers, null, 4);
            
        let requestType = 'Request';
        if (curlObject.isForm) {
            requestType = 'FormRequest';
        }
        let result = `from scrapy.http import ${requestType}\n`
                    + `\n`
                    + `url = '[[url]]'\n`
                    + (headersText ? '\nheaders = [[headers]]\n' : '')
                    + (cookieText ? '\ncookies = [[cookies]]\n' : '')
                    + (curlObject.body ? `\nbody = '[[body]]'\n` : '')
                    + `\nrequest = ${requestType}(\n`
                    + `    url=url,\n`
                    + `    method='[[method]]',\n`
                    + `    dont_filter=True,\n`
                    + (cookieText ? '    cookies=cookies,\n' : '')
                    + (headersText ? '    headers=headers,\n' : '')
                    + (curlObject.body ? '    body=body,\n' : '')
                    + `)\n`

        result = result.replace('[[url]]', curlObject.url)
        .replace('[[headers]]', headersText)
        .replace('[[cookies]]', cookieText)
        .replace('[[method]]', curlObject.method)
        .replace('[[body]]', curlObject.body)

        scrapyField.val(result);
    } catch (e) {
        scrapyField.val('Something went wrong...' + '\n' + e);
    }
};

// Translate on paste function + callback
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
    curl2scrapy($(this).val());
  }
});

// Button click
btn.click(function(e){
    curl2scrapy(curlField.val());
});

format.change(function() {
    if ($(this).val() === "parse") {
        $('#form2 > label[for="scrapy"]').removeAttr("hidden");
        $("#scrapy").removeAttr("hidden");
    } else {
        $('#form2 > label[for="parse"]').removeAttr("hidden");
        $("#parse").removeAttr("hidden");
    }
});