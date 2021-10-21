# -*- coding: utf-8 -*-
import argparse
import json
import re
import shlex
from collections import OrderedDict, namedtuple

from six.moves import http_cookies as Cookie

ParsedContext = namedtuple('ParsedContext', ['method', 'url', 'data', 'is_form', 'headers', 'cookies'])

def normalize_newlines(multiline_text):
    return multiline_text.replace(" \\\n", " ")

def get_curl_parser():
    parser = argparse.ArgumentParser()
    # these options ignore some possible options but seem to capture all the ones used when you copy as cURL in browsers
    parser.add_argument('command')
    parser.add_argument('url')
    parser.add_argument('-d', '--data')
    parser.add_argument('-b', '--data-binary', '--data-raw', default=None)
    parser.add_argument('-X', default='')
    parser.add_argument('-H', '--header', action='append', default=[])
    parser.add_argument('--compressed', action='store_true')
    parser.add_argument('-k','--insecure', action='store_true')
    parser.add_argument('--user', '-u', default=())
    parser.add_argument('-i','--include', action='store_true')
    parser.add_argument('-s','--silent', action='store_true')
    return parser

def parse_context(curl_command):
    method = "get"
    tokens = shlex.split(normalize_newlines(curl_command))
    parsed_args = get_curl_parser().parse_args(tokens)

    post_data = parsed_args.data or parsed_args.data_binary
    if post_data:
        method = 'post'

    if parsed_args.X:
        method = parsed_args.X.lower()

    cookie_dict = OrderedDict()
    quoted_headers = OrderedDict()

    form = False
    for curl_header in parsed_args.header:
        if curl_header.startswith(':'):
            occurrence = [m.start() for m in re.finditer(':', curl_header)]
            header_key, header_value = curl_header[:occurrence[1]], curl_header[occurrence[1] + 1:]
        else:
            header_key, header_value = curl_header.split(":", 1)

        if header_key.lower().strip("$") == 'cookie':
            cookie = Cookie.SimpleCookie(bytes(header_value, "ascii").decode("unicode-escape"))
            for key in cookie:
                cookie_dict[key] = cookie[key].value
        else:
            if header_key == "Content-Type" and "application/x-www-form-urlencoded" in header_value.strip():
                form = True
            quoted_headers[header_key] = header_value.strip()

    return ParsedContext(
        method=method,
        url=parsed_args.url,
        data=post_data,
        is_form=form,
        headers=quoted_headers,
        cookies=cookie_dict,
    )

def dict_to_pretty_string(the_dict, indent=4):
    if not the_dict:
        return "{}"

    return ("\n" + " " * indent).join(
        json.dumps(the_dict, sort_keys=True, indent=indent, separators=(',', ': ')).splitlines())

def parse_scrapy_commandline(curl_command, exclude_cookies):
    parsed_context = parse_context(curl_command)
    command = f"testmaster parse {parsed_context.url} --spider {parsed_context.spider} -c {parsed_context.callback} --method {parsed_context.method} --headers {parsed_context.headers}"
    if not exclude_cookies:
        command += f" --cookies {parsed_context.cookies}"
    if parsed_context.is_form:
        command += " --form"
        command += f" --formdata='{parsed_context.data}'"
    else:
        if parsed_context.data:
            command += f" --body='{parsed_context.data}'"
    return command

def parse_scrapy(curl_command, exclude_cookies):
    parsed_context = parse_context(curl_command)
    out = ''

    data_token = ''
    postdata_line = ''
    if parsed_context.data:
        if parsed_context.is_form:
            data_token = "formdata = {}".format(dict_to_pretty_string(parsed_context.data))
            postdata_line = "formdata=formdata"
        else:
            data_token = "payload = {}".format(dict_to_pretty_string(parsed_context.data))
            postdata_line = "body=json.dumps(payload)"
    

    headers_token = dict_to_pretty_string(parsed_context.headers)
    cookies_token = dict_to_pretty_string(parsed_context.cookies)
    out = ""
    if parsed_context.is_form:
        out += "from scrapy.http import FormRequest\n\n"
        request_name = "FormRequest"
    else:
        out += "from scrapy.http import Request\n"
        request_name = "Request"
        if parsed_context.data:
            out += "import json\n\n"
        else:
            out += "\n"
    out += f"headers = {headers_token}\n"
    if not exclude_cookies:
        out += f"cookies = {cookies_token}\n"
        cookies_line = f"{BASE_INDENT}cookies=cookies,\n"
    if parsed_context.data:
        out += f"{data_token}\n"

    out += f"{request_name}(\n{BASE_INDENT}url={parsed_context.url},\n{BASE_INDENT}method={parsed_context.method},\n{BASE_INDENT}headers=headers,\n{cookies_line}{BASE_INDENT}{postdata_line}"
    return out

if __name__ == "__main__":
    BASE_INDENT = " " * 4

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "curl", help="use this spider without looking for one"
    )
    parser.add_argument(
        "-t", "--tabs", dest="tabs", action="store_true",
        help="use tabs instead of spaces for indents"
    )
    parser.add_argument(
        "-ec", "--exclude_cookies", dest="exclude_cookies", default=False,
        action="store_true", help="exclude cookies from the representation"
    )

    args = parser.parse_args()
    # import sys
    # print(sys.argv[1:])
    # print(len(args.curl))
    print("\n")
    print(args.curl)
    # print("\n")
    print(shlex.split(args.curl))
    # if args.tabs:
    #     BASE_INDENT = "\t"
    # parse(args.curl, args.exclude_cookies)


