const https = require('https');
const URL = require('url');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const axios = require("axios"); // Hỗ trợ lấy content của webpage thông qua https request.
const cheerio = require("cheerio"); // hỗ trợ parsing DOM cực đơn giản. Thư viện này được cái nhẹ, dễ sử dụng và tốc độ nhanh.

// usage
if (process.argv[2] == null){
    console.log("Usage: node downloadMp3.js <dir_name> <path_name>");
    console.log("Where the download url is from https://basicenglishspeaking.com");
    process.exit(1);
}

class DownloadMP3 {
    BASE_URL = 'https://basicenglishspeaking.com';
    constructor({ dir_name, path_name }) {
        this.DIR_NAME = 'audios/' + dir_name;
        this.BASE_CRAWLER_URL = `${this.BASE_URL}/${path_name}/`;
        this.createDownloadDir();
        this.urls = [];
    }

    onStart = async () => {
        console.log('onStart');
        const $ = await this.fetchHtmlFromUrl(this.BASE_CRAWLER_URL);
        this.$ = $;
        this.urls = [...this.getFullMp3Lesson(), ...this.gatherUrls()];
        this.download(this.urls);
    }

    /**
     * Get all mp3 urls for download
     */
    gatherUrls = () => {
        const $ = this.$;
        const childMp3Urls = $('input.myButton_play');
        let urls = [];

        childMp3Urls.each((idx, ele) => {
            let onclickValue = ele.attribs.onclick;
            let reg = /\/wp-content\/uploads\/audio\/QA\/(.+)\.mp3/g;
            let match = reg.exec(onclickValue);
            urls.push(this.BASE_URL + match[0]);
        });

        return urls;
    }

    getFullMp3Lesson = () => {
        const $ = this.$;
        return [$('audio.wp-audio-shortcode a').attr('href')];
    }

    /**
    * Create our directory if it isn't already there
    */
    createDownloadDir = () => {
        if (!fs.existsSync(path.join(__dirname, this.DIR_NAME)))
            fs.mkdirSync(path.join(__dirname, this.DIR_NAME));
    }

    downloadFullMp3 = () => {
        this.fullUrls = this.getFullMp3Lesson();
        this.download(this.fullUrls);
    }

    downloadSeparateMp3 = () => {
        this.separatedUrls = this.gatherUrls();
        this.download(this.separatedUrls);
    }

    /**
     * We use this function to download one at a time so we don't overload the server
     * All mp3 file will be downloaded from https://basicenglishspeaking.com/
     */
    download = (urls) => {
        let url = urls.shift();

        if (url == null) {
            console.log("All done.");
            process.exit(0);
        }

        let parsedUrl = URL.parse(url);

        let url_options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: "GET"
        };

        let reg = /\/wp-content\/uploads\/audio\/QA\/(.+)/g;
        let mp3name = reg.exec(parsedUrl.path)[1];

        let ws = fs.createWriteStream(path.join(__dirname, this.DIR_NAME, mp3name));
        ws.on('finish', () => {
            console.log(`Finish downloading: ${url}`);
            this.download(urls);
        });

        https.request(url_options, res => res.pipe(ws)).end();
    }

    /**
     * Loads the html string returned for the given URL
     * and sends a Cheerio parser instance of the loaded HTML
     */
    fetchHtmlFromUrl = async url => {
        return await axios
            .get(this.enforceHttpsUrl(url))
            .then(response => cheerio.load(response.data))
            .catch(error => {
                error.status = (error.response && error.response.status) || 500;
                throw error;
            });
    };

    /**
     * Enforces the scheme of the URL is https
     * and returns the new URL
     */
    enforceHttpsUrl = url =>
        _.isString(url) ? url.replace(/^(https?:)?\/\//, "https://") : null;
}

///////////////////////////////////////////////////////////////////////////////
// START DOWNLOADING
///////////////////////////////////////////////////////////////////////////////

// grab the urls
let [dirName, pathName] = process.argv.slice(2);

const dl = new DownloadMP3({
    'dir_name': dirName,
    'path_name': pathName
});
dl.onStart();
