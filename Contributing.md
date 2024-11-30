# Contributing to the Data
if you are sure you want to contribute, simply fork this repo, then add a pull request

# Interface
Interface are very basic from my end, javascript is my natural enemy. It is up to you to beautify the data. The intention is only to have basic data projected to be at least usable

# Data Structures
Using JSON as the only way to store data centrally. The current data structure for the JSON is th eonly way I could think of currently. There are multiple JSON files that will be explained further

There will be at least 2 layers of JSON files that on this repo; lang.json and xx_xx.json. 

## lang.json
This file is the first layer of the data, this acts primarily like a language hub where the visitor has to pick what language they want to see or which they understood on reading.

## xx_xxxx.json sets
This is the second layer, which is the actual data of the bus routes.

- Region - This is the rough area or region that the buses covers
- description - detailed description of what this entails, such as the area of coverage and such
- map - embedded map of the area that the bus covers, don't have to be very accurate
- busNumber - This is the number paint on the bus' body, such as [6A],[16A],[4A] and so on
- Destination - General location of their end of route where they(drivers) usually refer
- route - Google map link of the routes that they take. More explanations below
- notes - data accuracy;undef being unknown,incomplete being known partially, complete being fully known of their end to end routes
- remark - such as their schedules, conditions to depart and etc.

### route in the json
Create a 'direction' inside google map, choose commute by car. Pick end to end location, verify the projected routes. Add route along the blue lines to anchor/lock the routes. This is simply because google map will re-adjust the route to avoid any traffic congestion. We don't want google maps to re-route the data that may render the data inaccurate. 

Check the link after few hours or during its known heavy traffic congestion, adjust as you see fit.