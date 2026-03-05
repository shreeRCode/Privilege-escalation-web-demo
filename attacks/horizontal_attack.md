Horizontal Privilege Escalation

User Alice logs in.

Alice accesses:

/profile?id=3

This returns Bob's data.

This happens because the application does not verify that the requested ID belongs to the logged-in user.
