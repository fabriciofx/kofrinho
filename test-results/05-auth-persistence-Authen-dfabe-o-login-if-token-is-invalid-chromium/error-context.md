# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-auth-persistence.spec.ts >> Authentication State Persistence >> should redirect to login if token is invalid
- Location: e2e/05-auth-persistence.spec.ts:73:3

# Error details

```
Error: page.evaluate: SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```