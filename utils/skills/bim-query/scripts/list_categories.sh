#!/bin/bash
# List all available IFC categories with element counts

jq -r '.[] | "\(.category): \(.count)"' schema/categories.json
