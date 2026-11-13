# Extend membership numbers to 16 digits

The owner requested a four-by-four card-number presentation before the first assigned numbers were in use. The one-time conversion retains each existing 12-digit prefix and appends 0041, for example 482719368052 becomes 4827 1936 8052 0041. UUIDs, authentication links, visits, passes, payments, and QR claims do not change.

The new canonical database representation is text with a 16-digit constraint and a unique index. PostgreSQL allocates new values from a bounded, non-cycling bigint sequence through a restricted trigger. Text preserves all digits across JSON/JavaScript, including values beyond Number.MAX_SAFE_INTEGER. Explicit insert values are rejected; assigned values remain immutable after the owner-approved one-time conversion. Reruns preserve numbers and never rewind the allocator.

Deploy the compatibility application first: it displays 12 or 16 digits during rollout, rejects unsafe JavaScript numeric input, and accepts either the original 12-digit number or its 16-digit extension in staff verification. Then apply 20261113020000_sixteen_digit_member_numbers.sql to the gym database. The revised search RPC accepts both number versions plus the original UUID/TC references. No old references become authentication credentials.

Validation covers exact conversion, UUID preservation, stable reruns, old/new search, automatic assignment, immutability, explicit-value rejection, exact text at 9999999999999999, exhaustion handling, and four-group card rendering. Live database and deployment verification are recorded after rollout. New icon directions are supplied separately for selection; no icon is changed without the owner's choice.
