#!/bin/bash

i=0
while [ $i -le 1 ]; do
    node webcrawler.js >> webcrawler.log 2>&1
done
