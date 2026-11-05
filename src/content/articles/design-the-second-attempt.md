---
status: published
title: 'Design the second attempt'
description: 'How to test save errors so people can fix mistakes, retry failed requests, and keep their edits.'
publishedAt: '2026-10-23'
---

Someone edits a customer record and clicks Save. The request fails.
Prototype what happens next. Where does the error appear? Which edits
stay in the form? How does the person try again?

## Separate correction from retry

An invalid email address needs a correction. An unavailable service
needs a retry. These states should give different guidance.

Put an error next to the invalid field and explain how to fix it.
If the service is unavailable, explain that the save failed and give
the person a way to retry.

## Keep the work visible

Keep the form open with the edits in place. The person should be able
to review what they entered before trying again. Show that the changes
are saved once the request succeeds.

## Prototype the second attempt

Build both recovery paths into the prototype.

- Submit the form with one invalid value and check where the error appears.
- Correct the field and check that the other values stay in place.
- Submit again and simulate a failed request. Check that the edits remain visible.
- Retry the save. Check that confirmation appears after the request succeeds.

Ask someone to try both paths without explaining the controls. Watch
whether they can find what to fix, retry without retyping, and tell when
the changes are saved.
