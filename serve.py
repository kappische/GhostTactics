import os, http.server
port = int(os.environ.get('PORT', 8080))
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=port, bind='127.0.0.1')
