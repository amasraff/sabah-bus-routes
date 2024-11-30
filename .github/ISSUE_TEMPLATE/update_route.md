---
name: Update Route
about: Request to have a route to be modified/updated if there's any changes
title: Update Route
labels: modify
assignees: ''

---

** Guide **
specify details as outlined below
[old] > [new]

Region: NORTH > WEST
bus number: 6A > 6B
destination: Putatan > kinarut
route: [old link] > [new link]
notes: [old] > [new]
remarks: [old] > [new]

Only 'remarks' are allowed to be appended. 

If some part of the data supposed to stay, you still have to specify which data so I will know which one to update such as follows

Region: NORTH 
bus number: 6A
destination: Putatan
route: [old link] > [new link]
notes: [old] > [new]
remarks: [old] > [new]

The above example means NORTH region, bus number, destination stays, but route, notes and remarks will be updated

To append additional info into remarks, do the following
Region: NORTH > WEST
bus number: 6A > 6B
destination: Putatan > kinarut
remarks: [old] + [new]
