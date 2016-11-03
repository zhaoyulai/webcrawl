#!/bin/bash

ps -ef | grep "start_hunter" | awk '{print $2}' | xargs kill -9
ps -ef | grep "hunter_server" | awk '{print $2}' | xargs kill -9
