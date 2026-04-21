---
name: Add route request
about: Add new known route
title: Add Route
labels: new route
assignees: ''

---

**Add Route**
Add details as outlined below

File: kk_centre / kk_others / intercity
```
{
      "busNumber": "6A",
      "towards": [
        {
          "destination": "Sepanggar",
          "route": "https://maps.app.goo.gl/L1vjrHjVPSDcCMhc6",
          "notes": "complete"
        },
        {
          "destination": "Kota Kinabalu",
          "route": "https://maps.app.goo.gl/Fv4ZyMjG3pCuPdsv5",
          "notes": "complete"
        }
      ],
      "colour": "BLUE",
      "remark": "wait until full",
      "date_check": "25-04-21"
    }
```
For `notes`, there are 3 states to this primarily for the google maps route; `undef` being not confirmed, `partial` being route is known but start/end of route are not known, `complete` having all of their route information are 100% reliable

For `colour`, accepted values are `BLUE`, `ORANGE`, `PURPLE`, `RED`

For `date_check`, use format `yy-mm-dd`