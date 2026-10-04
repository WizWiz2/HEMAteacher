#!/bin/bash
cd /workspace/hema/real; while [ ! -f dl_done ]; do sleep 5; done
sed -i 's#\.\./dl_list.txt#../dl_list2.txt#; s#dl_done#dl2_done#' dl.sh; ./dl.sh
