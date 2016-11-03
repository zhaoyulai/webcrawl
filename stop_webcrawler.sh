#!/bin/bash

ps -ef | grep "start_webcrawler" | awk '{print $2}' | xargs kill -9
ps -ef | grep "webcrawler" | awk '{print $2}' | xargs kill -9
