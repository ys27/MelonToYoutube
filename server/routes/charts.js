const Chart = require('../models/chart');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const moment = require('moment-timezone');

const config = require('../config');

const router = express.Router();

const endpoint = 'https://www.melon.com/chart';

/*
Assumes that the chart update times are:
monthly: first day of month at 14:00
weekly: every Tuesday at 14:00
daily: every day at 14:00
*/

router.get('/', (req, res) => {
    let chartType = req.query.chartType || '';
    let classCd = req.query.classCd || 'GN0000';
    Chart.findOne({ classCd, chartType }, (err, chart) => {
        if (err) throw err;
        const currentDate = moment().tz('Asia/Seoul');
        let lastUpdateDate = moment().tz('Asia/Seoul');
        let shouldUpdate = false;
        switch(chartType) {
            case 'month':
                lastUpdateDate = (lastUpdateDate.date() === 1 && lastUpdateDate.hour() >= 14) || lastUpdateDate.date() > 1 ?
                    lastUpdateDate.startOf('month').add(14, 'hours') : lastUpdateDate.startOf('month').subtract(1, 'months').add(14, 'hours');
                break;
            case 'week':
                lastUpdateDate = (lastUpdateDate.day() === 2 && lastUpdateDate.hour() >= 14) || lastUpdateDate.day() > 2 ?
                    lastUpdateDate.startOf('week').add(2, 'days').add(14, 'hours') : lastUpdateDate.startOf('week').subtract(5, 'days').add(14, 'hours');
                break;
            case 'day':
                lastUpdateDate = lastUpdateDate.hour() >= 14 ?
                    lastUpdateDate.startOf('day').add(14, 'hours') : lastUpdateDate.startOf('day').subtract(1, 'days').add(14, 'hours');
                break;
            default:
                break;
        }
        shouldUpdate = chart ? lastUpdateDate.isAfter(chart.retrievedDate) : false;
        if (!chart || (chart && shouldUpdate)) {
            let url = `${endpoint}/${chartType}/index.htm`;
            // url = filter ? url + '?classCd=' + filter : url;
            return axios.get(url, { params: { classCd } })
            .then((html) => {
                const $ = cheerio.load(html.data);
                let songs = [];
                let counter = 0;
                let numSongsOnChart = -1; //added this because there were errors where there was less than 100 songs on the chart.
                $('.rank').each((i, elem) => {
                    numSongsOnChart++;
                });
                $('.ellipsis.rank01').find('a').each((i, elem) => {
                    songs[i] = {
                        rank: i+1,
                        title: $(elem).text()
                    };
                    // songs[i] = $(elem).text();
                });
                $('.ellipsis.rank02').each((i, elem) => {
                    let artistStr = '';
                    let currentArtist = $(elem).children()[0];
                    while (currentArtist.name !== 'span') {
                        artistStr += currentArtist.data || currentArtist.children[0].data;
                        currentArtist = currentArtist.next;
                    }
                    songs[i].artist = artistStr;
                    // songs[i] += ` / ${artistStr}`;
                    searchYoutube(songs[i]).then(({videoId, videoTitle}) => {
                        songs[i].videoId = videoId;
                        songs[i].videoTitle = videoTitle;
                        counter++;
                        if (counter === numSongsOnChart) {
                            const chart = new Chart({ classCd, chartType, songs, updatedDate: $('.yyyymmdd').text(), retrievedDate: lastUpdateDate });
                            chart.save();
                            res.send(chart);
                        }
                    });
                });
            })
            .catch((error) => {
                console.log(error);
            });
        }
        else {
            res.send(chart);
        }
    });
});

function searchYoutube(song) {
    const service = google.youtube({
        version: 'v3',
        auth: config.apiKey
    });
    const parameters = {
        part: 'snippet',
        type: 'video',
        maxResults: 1,
        q: `${song.title} - ${song.artist} audio`,
        // order:,
        // regionCode:,
        // relevanceLanguage:
    };
    return service.search.list(parameters)
    .then((res) => {
        // console.log(res.data.items[0].snippet.title);
        // console.log(res.data.items[0].id.videoId);
        // return new Promise((resolve, reject) => {
        //     if (res.data.items.length === 1) {
        //         resolve(res.data.items[0].id.videoId);
        //         // resolve(res.data.items[0].snippet.title);
        //     }
        //     reject('');
        // });
        return {
            videoId: res.data.items[0].id.videoId,
            videoTitle: res.data.items[0].snippet.title
        };
        // return res.data.items[0].snippet.title;
    })
    .catch((error) => {
        console.log(error);
    });
}

module.exports = router;
