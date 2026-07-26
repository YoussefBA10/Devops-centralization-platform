import re

file_path = 'gitops/vmpipe/docker-compose.yml'
with open(file_path, 'r') as f:
    content = f.read()

base = '/home/vmpipe/Devops-centralization-platform/gitops/vmpipe'
content = re.sub(r'(\s+-\s+)\./', rf'\g<1>{base}/', content)
content = re.sub(r'(\s+-\s+)\.\./ansible', rf'\g<1>{base}/../ansible', content)
content = re.sub(r'(\s+-\s+)\.\./\.\./gitops', rf'\g<1>{base}/../../gitops', content)

with open(file_path, 'w') as f:
    f.write(content)
