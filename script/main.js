const siteUrl = 'http://www.thebaseballcube.com/minors/teams/'
const axios = require('axios')
const cheerio = require('cheerio')
const createCsvWriter = require('csv-writer').createArrayCsvWriter
const wiki = require('wikijs').default
const async = require('async')

/**
 * These are custom fixes we want to make to the data where there's no specific rule.
 * @param {string} name
 */
const fixes = (name) => {
  name = name.replace(' ** ', '')
  if (name === 'Dominican Phillies Red') {
    return 'Dominican Summer League Phillies'
  } else if (name === 'Dominican Phillies White') {
    return 'Dominican Summer League Phillies'
  } else if (name === 'Dominican Cardinals Blue') {
    return 'Dominican Summer League Cardinals'
  } else if (name === 'Dominican Cardinals Red') {
    return 'Dominican Summer League Cardinals'
  } else if (name === 'Dominican Royals 2') {
    return 'Dominican Summer League Royals'
  } else if (name === 'Dominican Yankees 2') {
    return 'Dominican Summer League Yankees'
  } else if (name === 'Dominican Cubs 2') {
    return 'Dominican Summer League Cubs'
  } else if (name === 'Dominican Pirates 2') {
    return 'Dominican Summer League Pirates'
  } else if (name === 'Arizona Cubs 2') {
    return 'Arizona League Cubs'
  } else if (name === 'Arizona Indians 2') {
    return 'Arizona League Indians'
  } else if (name === 'Arizona Giants Orange') {
    return 'Arizona League Giants'
  } else if (name.indexOf('Arizona') === 0) {
    const parts = name.split(' ')
    return `Arizona League ${parts.splice(1).join(' ')}`
  } else if (name.indexOf('Dominican') === 0) {
    const parts = name.split(' ')
    return `Dominican Summer League ${parts.splice(1).join(' ')}`
  } else {
    return name
  }
}

const getInfo = async (searchTerm, searchAppend, infoProperties) => {
  // first try to get exactly
  let page
  try {
    page = await wiki().page(searchTerm)
  } catch (ee) {
    // If we did not get exactly, do a general wikipedia search and grab the first result.
    const searchResults = await wiki().search(searchAppend === '' ? searchTerm : searchTerm + ' ' + searchAppend)
    page = await wiki().page(searchResults.results[0])
  }
  try {
    const fullInfo = await page.fullInfo()

    if (fullInfo.general[infoProperties[0]] !== undefined) {
      return fullInfo.general[infoProperties[0]]
    } else if (fullInfo.general[infoProperties[1]] !== undefined) {
      return fullInfo.general[infoProperties[1]]
    } else {
      return false
    }
  } catch (e) {
    console.error('**** error in getInfo:', searchTerm, '---', infoProperties)
    console.error(e)
    return false
  }
}

/**
 * Gets the coordinates (lat/lon)
 * @param {string} searchTerm
 */
const getCoordinates = async searchTerm => {
  try {
    const searchResults = await wiki().search(searchTerm)
    const page = await wiki().page(searchResults.results[0])
    const coordinates = await page.coordinates()

    if (coordinates.lat !== null) {
      return {
        lat: coordinates.lat,
        lon: coordinates.lon
      }
    } else {
      return false
    }
  } catch (e) {
    return false
  }
}

/**
 * Given a Page Name, tries to get the location - first checks if it has a wikipedia location,
 * if not check the stadium/ballpark, if not use the "city".
 * @param {string} pn
 */
const getLocation = async pn => {
  const pageName = fixes(pn)
  // console.log('getLocation', pageName)

  try {
    let retCity = ''
    let retLat = 0
    let retLon = 0
    let latLonSpecificity = ''

    const searchTerm = pageName
    const city = await getInfo(searchTerm, 'minor league team', ['city'])
    if (city) {
      retCity = city
    }

    const coordinates = await getCoordinates(searchTerm)
    if (coordinates) {
      retLat = coordinates.lat
      retLon = coordinates.lon
      latLonSpecificity = 'teamPage'
    } else {
      // no coordinates - try stadium
      const stadium = await getInfo(searchTerm, 'minor league team', ['ballpark', 'stadium'])
      if (stadium) {
        // if no city yet, use staidum's city
        if (retCity === '') {
          const stadiumCity = await getInfo(stadium, '', ['city'])
          if (stadiumCity) {
            retCity = stadiumCity
          }
        }
        // if not coordinates yet, use stadium's coordinates
        if (retLat === 0 && retLon === 0) {
          const stadiumCoords = await getCoordinates(stadium)
          if (stadiumCoords) {
            // console.log('stadiumCoords', stadiumCoords)
            retLat = stadiumCoords.lat
            retLon = stadiumCoords.lon
            latLonSpecificity = 'stadium'
          }
        }
      }

      // if we still do not have coords, use city's coords
      if (city && retLat === 0 && retLon === 0) {
        const cityCoordinates = await getCoordinates(city)
        if (cityCoordinates) {
          retLat = cityCoordinates.lat
          retLon = cityCoordinates.lon
          latLonSpecificity = 'city'
        }
      }
    }

    const resObj = {
      city: retCity,
      lat: retLat,
      lon: retLon,
      latLonSpecificity: latLonSpecificity
    }
    // console.log('resolving:', resObj)
    return resObj
  } catch (e) {
    console.log('searching for: ', pageName)
    console.error('error calling wikipedia', e)
    return false
  }
}

const fetchData = async () => {
  const result = await axios.get(siteUrl)
  return cheerio.load(result.data)
}

/**
 * Main entry point - grabs data, enriches it, and writes the CSV.
 */
const main = async () => {
  const allData = []
  allData.push(['league', 'team', 'division', 'city', 'lat', 'lon', 'latLonSpecificity'])
  const $ = await fetchData()
  $('.dataGrid .dataRow').each((i, item) => {
    const league = $('td:nth-child(2)', item).text()
    const team = $('td:nth-child(3)', item).text().trim().replace(' **', '')
    const division = $('td:nth-child(4)', item).text()
    allData.push([league, team, division])
  })

  const total = allData.length
  // Run in series so we don't hit wikipedia's rateLimit
  await async.eachOfLimit(allData, 3, async (arr, i) => {
    console.log(`PERCENT COMPLETE: ${((i / total) * 100).toFixed(2)} (${i}/${total})`)
    if (i !== 0) {
      try {
        const locationObj = await getLocation(arr[1])
        // console.log('locationObj', locationObj);
        arr.push(locationObj.city)
        arr.push(locationObj.lat)
        arr.push(locationObj.lon)
        arr.push(locationObj.latLonSpecificity)
        return null
      } catch (e) {
        console.log('here1', e)
        return null
      }
    } else {
      console.log('here2')
      return null
    }
  })
  // const results = await Promise.all(promises);
  // console.log(results);
  // write the
  const csvWriter = createCsvWriter({
    header: allData[0],
    path: '../minor-league-baseball.csv'
  })

  allData.shift()
  csvWriter
    .writeRecords(allData) // returns a promise
    .then(() => {
      console.log('...Done')
    })
}

main()
// getLocation('Dominican Phillies Red'); // for debugging
