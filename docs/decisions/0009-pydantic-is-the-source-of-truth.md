# 0009. Formats are defined once, in Pydantic

**Decision.** Every file and API format is a Pydantic model in
`science/src/truesouth/contracts.py`. TypeScript types are generated from it and checked
in. A test fails if they are out of date.

**Why.** Four people's AI agents write code on both sides of the contracts. Hand-kept
copies drift. With generation, a format change breaks the frontend at compile time, in
the place that needs fixing.
