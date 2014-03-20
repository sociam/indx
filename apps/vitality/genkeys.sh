#!/bin/bash

openssl genrsa -out privkey.pem 1024
openssl rsa -pubout -in privkey.pem -out pubkey.pem
echo "private key >> "
cat privkey.pem
echo "public key >>"
cat pubkey.pem
