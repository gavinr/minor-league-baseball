# Minor League Baseball
Data set of minor league baseball teams

## Map

[![map](https://raw.githubusercontent.com/gavinr/minor-league-baseball/master/map.png)](https://arcgis.com/home/item.html?id=9ba5f21f49da4005a4acbecfd9589a1e)

## Source

The data was originally compiled from Wikipedia and [The Baseball Cube](http://www.thebaseballcube.com/minors/teams/) and continually improved here in GitHub.

## Contributing and Usage

Everyone is welcome to contribute or use [this data](https://github.com/gavinr/minor-league-baseball/blob/master/minor-league-baseball.csv).

## Script

A script is used to update the data CSV. It is located in the `script` folder. To run, make sure Node.js is installed, then:

```
cd script
npm install
node main.js
```

This will overwrite the `minor-league-baseball.csv` file in the top level directory.