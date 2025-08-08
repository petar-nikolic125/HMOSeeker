 Why you should do it regularly: https://github.com/browserslist/update-db#readme
Running PrimeLocation scraper for London...
Filters: {"city":"London","refresh":false}
Spawning Python process with args: [
  '/home/runner/workspace/server/services/scraper.py',
  'London',
  '1',
  '0',
  ''
]
Python process closed with code: 1
Stdout: 
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Scraper failed with code: 1
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Search failed: Error: Scraper failed with exit code 1: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

    at ChildProcess.<anonymous> (/home/runner/workspace/server/services/scraper-manager.ts:292:18)
    at ChildProcess.emit (node:events:524:28)
    at maybeClose (node:internal/child_process:1104:16)
    at Socket.<anonymous> (node:internal/child_process:456:11)
    at Socket.emit (node:events:524:28)
    at Pipe.<anonymous> (node:net:343:12)
10:05:49 PM [express] GET /api/search 500 in 90ms :: {"success":false,"error":"Search failed"}
Running PrimeLocation scraper for London...
Filters: {"city":"London","refresh":false}
Spawning Python process with args: [
  '/home/runner/workspace/server/services/scraper.py',
  'London',
  '1',
  '0',
  ''
]
Python process closed with code: 1
Stdout: 
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Scraper failed with code: 1
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Search failed: Error: Scraper failed with exit code 1: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

    at ChildProcess.<anonymous> (/home/runner/workspace/server/services/scraper-manager.ts:292:18)
    at ChildProcess.emit (node:events:524:28)
    at maybeClose (node:internal/child_process:1104:16)
    at ChildProcess._handle.onexit (node:internal/child_process:304:5)
10:06:21 PM [express] GET /api/search 500 in 56ms :: {"success":false,"error":"Search failed"}
Running PrimeLocation scraper for Manchester...
Filters: {"city":"Manchester","min_bedrooms":4,"max_price":500000,"keywords":"hmo","refresh":false}
Spawning Python process with args: [
  '/home/runner/workspace/server/services/scraper.py',
  'Manchester',
  '4',
  '500000',
  'hmo'
]
Python process closed with code: 1
Stdout: 
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Scraper failed with code: 1
Stderr: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

Search failed: Error: Scraper failed with exit code 1: Traceback (most recent call last):
  File "/home/runner/workspace/server/services/scraper.py", line 40, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'

    at ChildProcess.<anonymous> (/home/runner/workspace/server/services/scraper-manager.ts:292:18)
    at ChildProcess.emit (node:events:524:28)
    at maybeClose (node:internal/child_process:1104:16)
    at ChildProcess._handle.onexit (node:internal/child_process:304:5)
10:06:46 PM [express] GET /api/search 500 in 54ms :: {"success":false,"error":"Search failed"}