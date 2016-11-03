#!/bin/bash

i=0
while [ $i -le 1 ]; do
    date >> hunter_server.log
    node hunter_server.js >> hunter_server.log 2>&1
done
