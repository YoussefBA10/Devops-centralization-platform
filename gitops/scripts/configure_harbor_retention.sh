#!/bin/bash

# Harbor API configuration
HARBOR_URL="http://localhost:8083"
USERNAME="admin"
PASSWORD="Harbor12345" # Update if you changed the default password
PROJECT_NAME="monetique"

# 1. Get the Project ID
PROJECT_ID=$(curl -s -u "$USERNAME:$PASSWORD" -X GET "$HARBOR_URL/api/v2.0/projects?name=$PROJECT_NAME" -H "accept: application/json" | grep -o '"project_id":[0-9]*' | head -1 | awk -F':' '{print $2}')

if [ -z "$PROJECT_ID" ]; then
    echo "Project '$PROJECT_NAME' not found!"
    exit 1
fi

echo "Found Project ID for '$PROJECT_NAME': $PROJECT_ID"

# 2. Check if a retention policy already exists for this project
EXISTING_RETENTION=$(curl -s -u "$USERNAME:$PASSWORD" -X GET "$HARBOR_URL/api/v2.0/retentions?project_id=$PROJECT_ID" -H "accept: application/json")

# The endpoint /api/v2.0/retentions POST requires a specific payload for the policy
echo "Setting Tag Retention Policy to keep the last 3 images for project '$PROJECT_NAME'..."

cat <<EOF > retention_payload.json
{
  "algorithm": "or",
  "rules": [
    {
      "action": "retain",
      "template": "always",
      "params": {
        "latestPushedK": 3
      },
      "tag_selectors": [
        {
          "kind": "doublestar",
          "decoration": "matches",
          "pattern": "**"
        }
      ],
      "scope_selectors": {
        "repository": [
          {
            "kind": "doublestar",
            "decoration": "matches",
            "pattern": "**"
          }
        ]
      }
    }
  ],
  "trigger": {
    "kind": "Schedule",
    "settings": {
      "cron": "0 0 * * * *" 
    }
  },
  "scope": {
    "level": "project",
    "ref": $PROJECT_ID
  }
}
EOF

# 3. Apply the retention policy
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$USERNAME:$PASSWORD" -X POST "$HARBOR_URL/api/v2.0/retentions" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d @retention_payload.json)

if [ "$HTTP_CODE" -eq 201 ]; then
    echo "Successfully created Tag Retention Policy! Harbor will now only keep the 3 latest images."
else
    echo "Failed to create Tag Retention Policy or policy already exists. HTTP Status Code: $HTTP_CODE"
    echo "If it already exists, you can manage it from the Harbor UI under Project -> Policy -> Tag Retention."
fi

rm retention_payload.json
