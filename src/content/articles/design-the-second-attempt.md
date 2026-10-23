---
status: published
title: 'Design the second attempt'
description: 'A practical way to test error recovery: preserve the work, explain the problem, and make the next attempt clear.'
publishedAt: '2026-10-23'
---

A save button is easy to prototype. A failed save forces more useful
decisions: which values stay in the form, where the error appears,
and how someone tries again.

Take a simple flow: someone edits a customer record and clicks Save.
The request fails. An error message explains the problem. Keeping
their edits makes recovery possible.

## Separate correction from retry

An invalid email address needs a correction. An unavailable service
needs a retry. These states should give different guidance.

For an invalid field, explain what needs to change and place the
message next to it. For a failed request, explain that saving failed
and provide a clear way to try again. Keep valid input in both cases.

## Keep the work visible

Leave the entered values in place. Avoid resetting the form or closing
it after an unsuccessful save.

The interface should also distinguish entered changes from confirmed
saved data. Preserve the draft, but show success only after the save
has been confirmed.

## Prototype the second attempt

Add a short recovery path to the prototype:

- Submit a form with one invalid value.
- Correct it without re-entering the other fields.
- Simulate an unsuccessful save.
- Retry with the changes still present.

Ask someone else to follow that path without explaining the controls.
Watch for repeated typing, uncertainty about what was saved, and
difficulty finding the next action.

A useful review ends with a concrete observation: the person recovered
from the error and completed the task without rebuilding their work.
