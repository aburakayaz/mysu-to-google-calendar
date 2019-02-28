// Client ID and API key from the Developer Console
const CLIENT_ID = '197424454819-lbdl0oae7t19604mql2aibgdc01u46eb.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBh2n_He6PjNUOuL10SGai90CF1pCMpSzA';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let CALENDAR = null;

//  DOM References
const termScheduleLink = document.getElementById('term-schedule-link');
const termSubmitForm = document.getElementById('term-submit-form');
termSubmitForm.onchange = termSubmit;
termSubmitForm.onsubmit = termSubmit;

const pasteArea = document.getElementById('paste');
pasteArea.onchange = parseAndShowSchedule;

const authorizeButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const authorizedActions = document.getElementById('authorized-actions');
const addButton = document.getElementById('add-button');
const deleteButton = document.getElementById('delete-button');
const notificationArea = document.getElementById('notificationArea');

//  Create global Current Term variables
let CURRENT_TERM_YEAR, CURRENT_TERM_TYPE;
let CURRENT_TERM_NUMERIC, CURRENT_TERM_VERBAL, CALENDAR_SUMMARY;

setTerm(2000, 'Fall');

function setTerm(year, type) {
    CURRENT_TERM_YEAR = year;
    CURRENT_TERM_TYPE = type;

    CURRENT_TERM_NUMERIC = `${CURRENT_TERM_YEAR}${CURRENT_TERM_TYPE === 'Fall' ? '01' : '02'}`;
    CURRENT_TERM_VERBAL = `${CURRENT_TERM_YEAR} ${CURRENT_TERM_TYPE}`;
    CALENDAR_SUMMARY = `"${CURRENT_TERM_VERBAL} Courses"`;

    //  Make DOM changes
    termSubmitForm.elements['current-term-year'].value = year;
    termSubmitForm.elements['current-term-type'].value = type;

    termScheduleLink.href = `https://mysu.sabanciuniv.edu/en/ajax/getCourseSchedule?termcode=${CURRENT_TERM_NUMERIC}`;

    for (const element of document.getElementsByClassName("calendar-summary")) {
        element.textContent = CALENDAR_SUMMARY;
    }

    for (const element of document.getElementsByClassName("current-term-verbal")) {
        element.textContent = CURRENT_TERM_VERBAL;
    }

    checkIfUserHasACalendarAlready();
}

function termSubmit(event) {
    event.preventDefault();

    const year = termSubmitForm.elements['current-term-year'].value;
    const type = termSubmitForm.elements['current-term-type'].value;
    setTerm(year, type);
}

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
        addButton.onclick = addCalendar;
        deleteButton.onclick = deleteCalendar;
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
async function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        authorizedActions.style.display = 'block';
        addButton.style.display = 'block';

        await checkIfUserHasACalendarAlready();
        return;
    }

    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
    authorizedActions.style.display = 'none';
    addButton.style.display = 'none';
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

/**
 * Prepend a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function addNotification(message) {
    const notification = document.createElement("p");
    const timeStamp = new Date().toTimeString().split(' ')[0];
    notification.innerHTML = `${timeStamp} | ${message}`;
    notificationArea.appendChild(notification);
}

let tableMatrix;
let firstWeek;
const recurrences = ['RRULE:FREQ=WEEKLY;COUNT=15'];

/**
 * Go to an anchor in a page.
 *
 * @param id
 */
function jump(id) {
    window.location = window.location.origin + window.location.pathname + '#' + id;
}

function fillRecurrences() {
    setFirstWeek();

    if (recurrences.length > 1) {
        return;
    }

    const date = new Date(firstWeek.getTime());
    date.setDate(date.getDate() + 56); // Add 8 weeks

    let i, j;
    for (i = 0; i < 5; i++) {
        for (j = 8; j <= 18; j++) {
            date.setHours(j + 3);
            date.setMinutes(40);
            recurrences.push('EXDATE;TZID=Europe/Istanbul:'
                + date.toISOString().replace(/[-:]/g, '').split('.')[0]);
        }
        date.setDate(date.getDate() + 1);
    }
}

function processAnHour(hour) {
    const regex = /(.*)((?:FASS|FMAN|FENS|SL)-[GL12]\d{3})/;
    let match;
    return hour.replace('\n', '')
        .split('\t')
        .filter(cell => {
            return cell !== '';
        })
        .map(cell => {
            if (match = regex.exec(cell)) {
                return {
                    'className': match[1],
                    'place': match[2]
                }
            }
            return cell;
        });
}

function getTableMatrix(text) {
    return text.split(/\d\d:\d\d/g) // Split the table to hours.
        .splice(1) // Take out the days row.
        .map(hour => { // Process each hour.
            return processAnHour(hour);
        });
}

function fillSchedule() {
    const table = document.getElementById('schedule');
    let hour;
    for (let i = 1; i < tableMatrix.length; i++) {
        hour = tableMatrix[i - 1];
        for (let j = 0; j < hour.length; j++) {
            if (hour[j] === ' ') {
                continue;
            }
            table.rows[i].cells[j + 1].innerText = hour[j].className + '\n' + hour[j].place;
        }
    }
}

function parseAndShowSchedule() {
    tableMatrix = getTableMatrix(pasteArea.value);
    try {
        fillSchedule();
        document.getElementById('generated-schedule-row').classList.remove('d-none');
        // jump('schedule');
        addNotification('Generated your schedule.');
    }
    catch (e) {
        console.log("Parsing error", e);
        addNotification('Invalid schedule content!');
    }
}

function getStartTime(day, hour) {
    let date = new Date(firstWeek.getTime());
    date.setDate(date.getDate() + day);
    date.setHours(hour + 8);
    date.setMinutes(40);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.toISOString();
}

function getEndTime(startTime) {
    let hour = startTime.substr(11, 2);
    let nextHour = (+hour + +1).toString();
    if (nextHour.length < 2) {
        nextHour = '0' + nextHour;
    }
    startTime = startTime.replace(hour + ':', nextHour + ':');
    return startTime.replace(':40', ':30')
}

function getCourseRequest(calendarId, className, place, day, hour) {
    place = place.split('-').join(' ');
    className = className.split('-').join(' ');

    let startTime = getStartTime(day, hour);
    let endTime = getEndTime(startTime);

    fillRecurrences();

    let event = {
        'start': {
            'dateTime': startTime,
            'timeZone': 'Europe/Istanbul'
        },
        'end': {
            'dateTime': endTime,
            'timeZone': 'Europe/Istanbul'
        },
        'location': place + ' Sabancı University',
        'reminders': {
            'useDefault': false
        },
        'summary': className,
        'recurrence': recurrences
    };

    console.log(event);

    return gapi.client.calendar.events.insert({
        'calendarId': calendarId,
        'resource': event
    });
}

function setFirstWeek() {
    if (firstWeek) {
        return;
    }
    firstWeek = new Date();
    let weekDifference = document.getElementById('week').value;
    firstWeek.setDate(firstWeek.getDate() - 7 * (weekDifference - 1));
    while (firstWeek.getDay() !== 1) {
        firstWeek.setDate(firstWeek.getDate() - 1);
    }
    firstWeek.setHours(0);
    firstWeek.setMinutes(0);
    firstWeek.setSeconds(0);
}

async function getUsersCalendars() {
    return new Promise(function (resolve, reject) {
        const request = gapi.client.calendar.calendarList.list();

        request.execute(function (response) {
            if (response.hasOwnProperty("items")) {
                resolve(response.items);
            }
            else {
                reject(response);
            }
        });
    })
}

async function checkIfUserHasACalendarAlready() {
    const calendars = await getUsersCalendars();

    const generatedCalendars = calendars.filter(
        calendar => calendar.summary === CALENDAR_SUMMARY
    );

    console.log("Already existing calendars:", generatedCalendars);

    if (generatedCalendars.length >= 1) {
        addNotification(`You already have a calendar for <i>${CALENDAR_SUMMARY}</i>.`);
        setCalendar(generatedCalendars[0]);
    }
    else {
        setCalendar(null);
    }
}

/**
 *  Precondition: CALENDAR is null
 */
async function addCalendar() {
    if (!tableMatrix) {
        addNotification('Please paste your schedule.');
        return;
    }

    addButton.setAttribute('disabled', null);

    try {
        const newCalendar = await createCalendar();
        await addCoursesToCalendar(newCalendar.id);
        setCalendar(newCalendar);
    }
    catch (e) {
        addNotification(e);
        setCalendar(null);
    }
}

async function createCalendar() {
    return new Promise(function (resolve, reject) {
        const request = gapi.client.calendar.calendars.insert({
            'summary': CALENDAR_SUMMARY,
            //  https://eduardopereira.pt/2012/06/google-calendar-api-v3-set-color-color-chart/
            'colorId': 8,
        });

        addNotification('Creating calendar...');

        request.execute(function (response) {
            console.log(response);

            if (response.hasOwnProperty('error')) {
                reject('Failed to create the calendar. Here is why:' + response.error.message);
                return;
            }

            addNotification('Calendar created.');
            resolve(response);
        });
    });
}

async function addCoursesToCalendar(calendarId) {
    return new Promise(function (resolve, reject) {
        addNotification("Adding courses...");

        setFirstWeek();

        const batch = gapi.client.newBatch();

        tableMatrix.forEach((row, hour) =>
            row.forEach((course, day) => {
                if (course === ' ') {
                    return;
                }
                batch.add(
                    getCourseRequest(calendarId, course.className, course.place, day, hour)
                );
            })
        );

        batch.execute(function (response) {
            console.log(response);

            if (response.hasOwnProperty('error')) {
                reject('Failed to add courses. Here is why:' + response.error.message);
                return;
            }

            addNotification('Courses added.');
            resolve();
        });
    });
}

/**
 *  Precondition: CALENDAR is not null
 */
function deleteCalendar() {
    deleteButton.setAttribute('disabled', null);

    const request = gapi.client.calendar.calendars.delete({
        'calendarId': CALENDAR.id,
    });

    request.execute(function (response) {
        console.log(response);

        if (response.hasOwnProperty('error')) {
            setCalendar(CALENDAR);
            addNotification(`Failed to delete <i>${CALENDAR.summary}</i>. Here is why:\n${response.error.message}`);
            return;
        }

        addNotification(`<i>${CALENDAR.summary}</i> is deleted.`);
        setCalendar(null);
    });
}

/**
 *  Sets the CALENDAR and changes other related states
 */
function setCalendar(calendar) {
    CALENDAR = calendar;

    if (calendar === null) {
        addButton.removeAttribute('disabled');
        deleteButton.setAttribute('disabled', null);
    }
    else {
        addButton.setAttribute('disabled', null);
        deleteButton.removeAttribute('disabled');
    }
}
