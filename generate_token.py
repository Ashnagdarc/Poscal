#!/usr/bin/env python3

import jwt
import json
import time

SECRET = "6TXrpcgE1JyJdkyKWhImwrEbSndjT8eGkCZVi3n1oxc="
PAYLOAD = {
    "sub": "test-user-123",
    "email": "test@example.com",
    "role": "authenticated",
    "aud": "authenticated",
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600
}

token = jwt.encode(PAYLOAD, SECRET, algorithm="HS256")
print(token)
