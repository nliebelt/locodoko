import os
import re

specs_dir = "specs"
specs_to_check = []
for f in os.listdir(specs_dir):
    if f.endswith(".md"):
        path = os.path.join(specs_dir, f)
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            if "Zu prüfen" in content:
                specs_to_check.append(path)

print(f"Checking {len(specs_to_check)} specs...")
for path in specs_to_check:
    print(f"\n--- {path} ---")
    with open(path, "r", encoding="utf-8") as file:
        content = file.read()
        # look for explicit "Fehlt", "Nicht implementiert", or check DoD items
        dods = re.findall(r'-\s*\[ \].*', content)
        if dods:
            print("Unchecked DoD items:")
            for dod in dods:
                print(dod)
        else:
            print("No unchecked DoD items.")

