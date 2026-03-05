#!/bin/bash
# List all building storeys/levels with their slugs

jq -r '.[] | "\(.name) (\(.slug))"' schema/storeys.json
