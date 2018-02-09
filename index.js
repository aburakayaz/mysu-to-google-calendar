// Client ID and API key from the Developer Console
let CLIENT_ID = '197424454819-lbdl0oae7t19604mql2aibgdc01u46eb.apps.googleusercontent.com';
let API_KEY = 'AIzaSyBh2n_He6PjNUOuL10SGai90CF1pCMpSzA';

// Array of API discovery doc URLs for APIs used by the quickstart
let DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
let SCOPES = 'https://www.googleapis.com/auth/calendar';

let authorizeButton = document.getElementById('authorize-button');
let signoutButton = document.getElementById('signout-button');
let authorizedActions = document.getElementById('authorized-actions');
let addButton = document.getElementById('add-button');
let testButton = document.getElementById('test-button');
let deleteButton = document.getElementById('delete-button');
testButton.onclick = printClasses;


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
        addButton.onclick = addClasses;
        deleteButton.onclick = deleteClasses;
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        authorizedActions.style.display = 'block';
        addButton.style.display = 'block';
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
function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    gapi.auth2.getAuthInstance().signOut();
}

/**
 * Prepend a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function prependPre(message) {
    let pre = document.getElementById('content');
    let textContent = document.createTextNode(message + '\n');
    pre.insertBefore(textContent, pre.firstChild);
}

let tableMatrix;
let firstWeek;
let recurrences = ['RRULE:FREQ=WEEKLY;COUNT=15'];

function fillRecurrences() {
    setFirstWeek();

    if (recurrences.length > 1) {
        return;
    }

    date = new Date(firstWeek.getTime());
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
    return hour.replace('\n', '').split('\t')
        .filter(cell => {
            return cell !== '';
        }).map(cell => {
            if (match = regex.exec(cell)) {
                return {
                    'name': match[1],
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
    classesToAdd = -1;
    let table = document.getElementById('schedule');
    let hour;
    for (let i = 1; i < 12; i++) {
        hour = tableMatrix[i - 1];
        for (let j = 0; j < hour.length; j++) {
            console.log(i, j, hour);
            if (hour[j] === ' ') {
                continue;
            }
            table.rows[i]
                .cells[j + 1]
                .innerText = hour[j].name + '\n' + hour[j].place;
            classesToAdd++;
        }
    }
}

function printClasses() {
    let text = document.getElementById('paste').value;
    tableMatrix = getTableMatrix(text);
    fillSchedule();
}

let eventsToDelete = -1;

function decreaseEventsToDelete() {
    if (eventsToDelete == 0) {
        prependPre('SUCCESSFULLY DELETED');
    }

    eventsToDelete--;
}

let classesToAdd = -1;

function decreaseClassesToAdd() {
    if (classesToAdd == 0) {
        prependPre('SUCCESSFULLY SYNCED!');
    }

    classesToAdd--;
}

function deleteEvent(eventId) {
    var request = gapi.client.calendar.events.delete({
        'calendarId': 'primary',
        'eventId': eventId
    });

    request.execute(function (event) {
        prependPre('Event deleted');
        decreaseEventsToDelete();
    });
}

function deleteEvents(events) {
    let delay = 0;
    eventsToDelete += events.length;
    events.forEach(event => {
        if (event.recurrence.indexOf('RRULE:FREQ=WEEKLY;COUNT=15') == -1) {
            return;
        }
        if (event.summary.search(/[A-Z]+ \d+/) == -1) {
            return;
        }
        setTimeout(deleteEvent, delay, event.id);
        delay += 200;
    });
}

function deleteBetweenDates(beginDate, endDate) {
    let request = gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'maxResults': 2500,
        'timeMin': beginDate.toISOString(),
        'timeMax': endDate.toISOString()
    });

    request.execute(function (events) {
        console.log(events);
        deleteEvents(events.items);
    });
}

function deleteClasses() {
    setFirstWeek();

    let date = new Date(firstWeek.getTime());
    date.setHours(0);
    date.setDate(date.getDate() + 7);
    let endDate = new Date(date.getTime());
    endDate.setDate(endDate.getDate() + 7);

    deleteBetweenDates(date, endDate);
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

function addClass(_class, place, day, hour) {
    place = place.split('-').join(' ');
    _class = _class.split('-').join(' ');

    let startTime = getStartTime(day, hour);
    let endTime = getEndTime(startTime);

    fillRecurrences()

    let event = {
        'start': {
            'dateTime': startTime,
            'timeZone': 'Europe/Istanbul'
        },
        'end': {
            'dateTime': endTime,
            'timeZone': 'Europe/Istanbul'
        },
        'location': place + ' Sabancı Üniversitesi',
        'reminders': {
            'useDefault': false
        },
        'summary': _class,
        'recurrence': recurrences
    };

    console.log(event);

    let request = gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': event
    });

    request.execute(function (event) {
        prependPre('Event created: ' + event.htmlLink);
        decreaseClassesToAdd();
    });
}

function setFirstWeek() {
    if (firstWeek) {
        return;
    }
    firstWeek = new Date();
    weekDifference = document.getElementById('week').value;
    firstWeek.setDate(firstWeek.getDate() - 7 * (weekDifference - 1));
    while (firstWeek.getDay() != 1) {
        firstWeek.setDate(firstWeek.getDate() - 1);
    }
    firstWeek.setHours(0);
    firstWeek.setMinutes(0);
    firstWeek.setSeconds(0);
}

function addClasses() {
    setFirstWeek();

    let delay = 0;

    tableMatrix.forEach((row, hour) => {
        for (let i = 0; i < row.length; i++) {
            if (row[i] === ' ') {
                continue;
            }
            setTimeout(addClass, delay, row[i].name,
                row[i].place, i, hour);
            delay += 500;
        }
    });
}

