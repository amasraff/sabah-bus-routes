---
name: Update Route
about: Request to have a route modified/updated if there are any changes
title: Update Route
labels: modify
assignees: ''

---

**Guide**
Use this to correct or update an existing route's data. `busNumber` and `file` are required to locate the entry. All other fields are optional — only fill in what has changed.

- Use `[old] > [new]` for any field you want to replace
- Use `[old] + [new]` for `remark` only, if you want to append instead of replace
- Leave a field blank if it should stay as-is

**Required**
```
file: kk_centre / kk_others / intercity
busNumber: 6A
```

**Optional (only fill in what changed)**
```
destination: Putatan > Kinarut
route: [old link] > [new link]
notes: partial > complete
colour: BLUE > RED
remark: [old] > [new]
date_check: 25-04-21
```

For `notes`, accepted values are `undef`, `partial`, `complete`

For `colour`, accepted values are `BLUE`, `ORANGE`, `PURPLE`, `RED`

For `date_check`, use format `yy-mm-dd`. Only include if you have re-observed the route.

For `remark`, to append instead of replace:
```
remark: [old] + [new]
```