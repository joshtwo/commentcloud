// ==UserScript==
// @name Comment CLOUD
// @namespace deviant-garde.deviantart.com
// @description This allows you to use the Emote CLOUD (http://thezikes.com/emotecloud) on the forums for thumbnail shortcuts.
// @version 0.7
// @grant GM_xmlhttpRequest
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @include http://*.deviantart.com/*
// ==/UserScript==

// Since Comment CLOUD is essentially a renamed Forum Cloud with an expanded
// set of features, this script is going to start at version 0.8 where
// Forum Cloud's public release left off.
// It currently has features and bug fixes that were initially unreleased
// This will currently only work for those with beta testing off, so be careful

// something to save the typing
$w = unsafeWindow;

// the part of the Forum Cloud script that's put in the content page scope
commentCloudScript = function() {
    commentCloud = {
        // self-explanatory
        version: "0.8-messing-with-mood-code",
        // this is the list of public emotes retrieved from the Emote Cloud
        publicEmotes: {},
        // these are the custom emotes YOU defined for yourself (currently ignored)
        customEmotes: {},
        // this is where votes made before the emote list is refreshed are stored
        votes: {},
        // these are the emotes stored by lexigraphical order
        orderedEmotes: {public: {}, private: {}},
        // this stores an array of sorted search results
        searchResults: [],
        // this holds the node containing the emotes menu
        // good for saving the user's browser from constantly recreating it
        modalNode: null,
        // this node is where the emote images get put
        emoteNode: null,
        // the node that holds the search results
        resultsBox: null,
        // this stores the sub-modals that are shown when you click the buttons on the main modal node
        // no point in constantly regenerating them
        subModal: {help: null, about: null},
        // if this is set to true, then the menu will be forcibly recreated when it's loaded
        // used for when there are errors or the emote list is refreshing
        refreshMenu: false,
        // when a vote is made, its corresponding li node is stored here with the key of its code 
        // because the code or devid on its own can refer to more than one entry in the Emote Cloud
        voteNodes: {},
        // when clicking an emote in the menu, the emote code will appear in this textbox
        textbox: null,
        // these are a few settings related to using the cloud
        settings: {
            // used for the emote list
            category: "a"
        },
        // this handles storage requests
        requests: {
            push: {},
            pull: {},
            sendPush: false,
            sendPull: false
        },
        errorString: function() {
            if (commentCloud.publicEmotes.cloudError)
            {
                // since there's an error, we need to make sure we refresh the menu next time in case it's resolved
                this.refreshMenu = true;
                switch (commentCloud.publicEmotes.cloudError)
                {
                    case 1:
                        return "The emote list has not loaded yet. Please wait and try again. If nothing changes then try refreshing the emote list.";
                    case 2:
                        return "No response from the emote cloud. Please try refreshing the emote list.";
                    case 3:
                        return "The emote list is empty. Please try refreshing the emote list, or if it is already refreshing, please wait.";
                    default:
                        return commentCloud.publicEmotes.cloudError;
                }
            }
            else return "No error.";
        },
        getEmoteCount: function() { var count = 0; for (var x in commentCloud.publicEmotes) ++count; return count; },
        // add CSS rules specific to commentcloud elements
        addStyle: function()
        {
            //var cssNode = document.createElement('link');
            var cssNode = document.createElement('style');
            /*cssNode.rel = 'stylesheet';
            cssNode.type = 'text/css';
            cssNode.href = 'http://localhost/userscripts/commentcloud.css';*/
            cssNode.id = 'commentcloud-style';
            cssNode.innerHTML = '#commentcloud-modal { width: 35em; } #commentcloud-modal p { padding: 0.3em; } #commentcloud-emotes { position: relative; } #commentcloud-emotes img { position: absolute; display: none; z-index: 9001; background-color: #dde6da; border: 1px solid #aab5ab; } #commentcloud-menu { margin: 5px; overflow-y: scroll; border: 1px solid #aab5ab; height: 18em; } #commentcloud-menu ul { list-style-image: none; list-style-position: outside; padding: 0; margin: 0; } #commentcloud-menu ul li { display: block; padding: 0; list-style-type: none; } #commentcloud-menu ul li:hover { background-color: #e7eee7 !important; } #commentcloud-menu ul li.even { background-color: #dae4d9; } #commentcloud-menu ul li.odd { background-color: #cedccd; } #commentcloud-menu * div.ar { background: none; padding: 0; } #commentcloud-categories { font-size: 0.75em; text-align: center; } #commentcloud-categories a { padding: 0.2em; } #commentcloud-categories a.selected { font-weight: bold; } .vote-buttons a, .vote-buttons span { margin: 0.2em; } .vote-buttons span { visibility: hidden; } .vote-buttons span.votecount { margin-right: 3em; visibility: visible; } .vote-buttons .voted { color: #bcbcbc; visibility: visible; } .sub-modal { width: 30em; } .sub-modal p { text-align: center; padding: 1.5em; } #commentcloud-search input { width: 95%; margin: auto; display: block } #commentcloud-search input.empty { color: #a0a0a0; } #commentcloud-category-search:first-child { font-style: italic; }'; 
            document.getElementsByTagName('head')[0].appendChild(cssNode);
        },
        // this displays the list of emotes in a window for the user to
        // select from and browse through, as well as to vote for
        showMenu: function(textbox) {
            try {
                this.textbox = textbox;
                if (this.refreshMenu)
                {
                    console.log("Refreshing menu...");
                    if (this.modalNode) this.modalNode.parentNode.removeChild(this.modalNode);
                    // hopefully the unused nodes will now be garbage collected too
                    this.modalNode = null;
                    this.emoteMenu = null; 
                    this.voteNodes = {};
                    this.refreshMenu = false;
                }
                if (!this.modalNode)
                {
                    console.log("Modal node doesn't exist, creating new one...");
                    this.modalNode = document.createElement('div');
                    this.emoteNode = document.createElement('div');
                    var menuNode = document.createElement('div');
                    var categoryNode = document.createElement('div');
                    
                    var searchForm = document.createElement('form');
                    var searchBox = document.createElement('input');
                    this.resultsBox = document.createElement('ul');
                    var modal, el, categoryLink;
                    
                    this.modalNode.id = 'commentcloud-modal';
                    this.modalNode.innerHTML = '<h2>Comment CLOUD</h2><p>Click on a letter to change categories.</p>';
                    
                    this.emoteNode.id = 'commentcloud-emotes';
                    menuNode.id = 'commentcloud-menu';
                    categoryNode.id = 'commentcloud-categories';
                    
                    el = document.createElement('ul');
                    el.id = 'commentcloud-category-' + this.settings.category;
                    
                    if (commentCloud.publicEmotes.cloudError)
                    {
                        menuNode.innerHTML = "<b>Error:</b> " + this.errorString();
                    }
                    else
                    {
                        if (!(this.orderedEmotes.public && this.orderedEmotes.public.a) || this.refreshMenu)
                            this.sortAllEmotes();
                        for (var x in this.orderedEmotes.public)
                        {
                            categoryLink = document.createElement('a');
                            categoryLink.href = '#';
                            categoryLink.textContent = x.toUpperCase();
                            if (x === this.settings.category)
                                categoryLink.setAttribute('class', 'selected');
                            categoryLink.id = 'category-link-' + x;
                            categoryLink.onclick = function() {
                                try {
                                    var thisCategory = this.textContent.toLowerCase();
                                    $('#commentcloud-category-' + commentCloud.settings.category)[0].style.display = 'none';
                                    $('#category-link-' + commentCloud.settings.category)[0].setAttribute('class', '');
                                    commentCloud.settings.category = thisCategory;
                                    var newEmoteList;
                                    if ((newEmoteList = $('#commentcloud-category-' + thisCategory)[0]) != null)
                                        newEmoteList.style.display = 'inline';
                                    else
                                    {
                                        el = document.createElement('ul');
                                        el.id = 'commentcloud-category-' + thisCategory;
                                        emoteList = commentCloud.orderedEmotes.public[thisCategory];
                                        menuNode.appendChild(commentCloud.makeEmoteList(emoteList, el));
                                    }
                                    this.setAttribute('class', 'selected');
                                    return false;
                                }
                                catch (e)
                                {
                                    console.log("categoryLink: " + e.message);
                                }
                            }
                            categoryNode.appendChild(categoryLink);
                        }
                        this.resultsBox.id = 'commentcloud-category-search';
                        this.resultsBox.style.display = 'none';
                        this.resultsBox.innerHTML = '<li>Type something in the search box and hit "Enter".</li>';
                        menuNode.appendChild(this.resultsBox);

                        categoryLink = document.createElement('a');
                        categoryLink.href = '#';
                        categoryLink.textContent = 'Search';
                        categoryLink.id = 'category-link-search';
                        categoryLink.onclick = function() {
                            try {
                                commentCloud.switchToSearch();
                                return false;
                            }
                            catch (e)
                            {
                                console.log("Search category link: " + e.message);
                            }
                        };
                        categoryNode.appendChild(categoryLink);
                        this.makeEmoteList(this.orderedEmotes.public[this.settings.category], el);
                        this.modalNode.appendChild(categoryNode);
                        menuNode.appendChild(el);
                    }
                    this.modalNode.appendChild(menuNode);
                    this.modalNode.appendChild(this.emoteNode);

                    searchBox.type = 'text';
                    searchBox.setAttribute('class', 'empty');
                    searchBox.value = 'Search for an emote...';
                    searchBox.onfocus = function() {
                        if (this.value === 'Search for an emote...')
                        {
                            this.setAttribute('class', '');
                            this.value = '';
                        }
                    };
                    searchBox.onblur = function() {
                        if (this.value === '')
                        {
                            this.value = 'Search for an emote...';
                            this.setAttribute('class', 'empty');
                        }
                    };
                    searchBox.onkeydown = function(e) {
                        if (e.keyCode === 13 || e.which === 13)
                        {
                            if (commentCloud.settings.category !== 'search') commentCloud.switchToSearch();
                            commentCloud.searchEmotes(this.value);
                            return false;
                        }
                    }

                    searchForm.id = 'commentcloud-search';
                    searchForm.appendChild(searchBox);

                    this.modalNode.appendChild(searchForm);
                }
                // I have no clue why, but the first time the window opens, it seems to ignore me setting showButtonsSeparator to false
                modal = Modals.factory(this.modalNode);
                // should I bother holding onto the sub-modals, or making link() a function outside of this method?
                // probably a small gain at the most, but it makes some sense in principal
                // also: one of the last few places the JS sets purely cosmetic style information on a per-node basis
                // and there's an obvious pattern here, although it only occurs twice right now...
                var link = function(url, text) { return '<a href="'+url+'" target="_blank">' + text + '</a>'; };
                
                if (!this.subModal.help) 
                    this.subModal.help = this.makeSubModal("Help",
                        'On the ' + link('http://thezikes.org/emotecloud', 'Emote Cloud') + ', you can add emoticons'
                      + ' and vote for their inclusion on the public emotes list (what you can use in the forums and dAmn).'
                      + ' When you add an emote, it has 3 votes by default, but requires 5 to be public.'
                      + ' Using the + and - buttons in the menu, you can vote for or against emotes that are already public'
                      + ', as you can have more than one emote that uses the same code and the submission with the highest'
                      + ' vote count is public. In other cases, you can search for the emote by typing part of the emote name in the search box and hitting enter.'
                      + ' to vote for it. Click the "Emote Cloud" button to go to the website.'
                      + '<br/><br/>When you first run the script, you get a list of public emotes that you can use in your posts; you currently have '
                      + commentCloud.getEmoteCount() + '! If you want to update the list so you can use newly added'
                      + ' emotes or emotes that have been switched around or updated, then click the "Refresh Emote List" link'
                      + ' right next to the "Comment CLOUD Menu" link.'
                      + '<br/><br/><em>NOTE: The list takes a little while to load, as it is HUMONGOUS, so wait a few seconds'
                      + ' for it to tell you that the list has updated before opening the menu again or it won\'t be there yet.</em>');
                
                if (!this.subModal.about)
                    this.subModal.about = this.makeSubModal("About Comment CLOUD v. " + commentCloud.version,
                        'Made by ~'+link("http://deviant-garde.deviantart.com/", "deviant-garde")+'. '
                      + 'Send me a '+link("http://deviant-garde.deviantart.com/art/Forum-Cloud-v-0-3-300654354","comment")+' if you have any questions. '
                      + 'Emote list comes from the '+link("http://www.thezikes.com/emotecloud/","Emote Cloud")+'. '
                      + '<br/><br/>This is <em>beta</em> software, so some things may not work as expected and many things are unfinished. '
                      + "This is where you come in with those comments. Don't be afraid to report bugs or make suggestions. "
                      + '<img src"http://e.deviantart.net/emoticons/p/paranoid.gif"/>');
                
                modal.addButton("Help", "smbutton-lightgreen", this.subModal.help);
                modal.addButton("About This Script", "smbutton-lightgreen", this.subModal.about);
                modal.addButton("Emote Cloud", "smbutton-blue", function() { window.open("http://thezikes.com/emotecloud", "_blank") });
                Modals.push(modal);
            }
            catch (e)
            {
                console.log("Error creating list: " + e.message);
            }
        },
        // does what any category link does, except specifically for the search because mutliple things
        // (clicking search button, clicking search category link) can trigger it, necessitating a method
        switchToSearch: function()
        {
            // it functions very much like the other category links (stealing the bold, opening new emote list, etc)
            // and the code reflects this
            $('#commentcloud-category-' + this.settings.category)[0].style.display = 'none';
            $('#category-link-' + this.settings.category)[0].setAttribute('class', '');
            commentCloud.settings.category = 'search'; // even takes over the category in the settings
            $('#category-link-search')[0].setAttribute('class', 'selected');
            commentCloud.resultsBox.style.display = 'inline';
        },
        makeSubModal: function(title, message)
        {
            var modalNode = document.createElement('div');
            modalNode.setAttribute('class', 'sub-modal');
            modalNode.innerHTML = '<h2>' + title + '</h2>';
            
            var p = document.createElement('p'), modal;
            p.setAttribute('class', 'text');
            p.innerHTML = message;
            modalNode.appendChild(p);
            
            modal = Modals.factory(modalNode);

            return function()
            {
                Modals.push(modal);
                return false;
            };
        },
        // generate an emote list and insert it into a given element
        makeEmoteList: function(emoteList, el) // remember that emoteList is a list like [':this:', ':that:', ':theother:']
        {
            try {
                var even = false; // controls the color of the element
                for (var key in emoteList)
                {
                    var emote = emoteList[key];
                    // for some reason, some of the emotes in the Emote Cloud have no image set...
                    if (!commentCloud.publicEmotes[emote].img) continue;
                    var li = document.createElement('li');
                    li.setAttribute('class', even ? 'even' : 'odd');

                    var menuItems = document.createElement('div');
                    var link = document.createElement('div');
                    var info = document.createElement('div');

                    menuItems.setAttribute('class', 'hh');
                    link.setAttribute('class', 'al');
                    link.innerHTML = '<a href="#" onclick="commentCloud.textbox.value+=\''+emote+'\'; return false">'+emote+'</a>';
                    info.setAttribute('class', 'ar');
                    menuItems.appendChild(link);
                    menuItems.appendChild(info);
                    // some hackery to keep the closures from keeping hold of some variables' updates
                    (function(emote, info) {
                        var img;
                        // this keeps the mouseover closure from being triggered
                        // when hovering over a child element of li
                        var hovering = false;
                        li.onmouseover = function(e) {
                            if (hovering) return;
                            else hovering = true;
                            if (!img)
                            {
                                img = commentCloud.createEmoteImg(emote);
                                commentCloud.emoteNode.appendChild(img);
                            }
                            img.style.display = 'inline';
                            commentCloud.hoverAtMouse(e, img);
                            commentCloud.addEmoteInfo(emote, info);
                            console.log("Hovering on ", emote);
                        };
                        li.onmousemove = function(e) {
                            commentCloud.hoverAtMouse(e, img);
                        };
                        li.onmouseout = function (e) {
                            // not sure how else to fix the flickering interface without recursing through parents/children
                            // can't remember what the reason for this might be, but might need to play with execution order of events; do it later
                            if (['vote-buttons', 'vote-count', 'ar'].indexOf(e.relatedTarget.parentNode.getAttribute('class')) !== -1)
                            {
                                //console.log(e.relatedTarget, "is a child of", e.relatedTarget.parentNode, ", returning...");
                                return;
                            }
                            hovering = false;
                            img.style.display = 'none';
                            commentCloud.hoverAtMouse(e, img);
                            commentCloud.removeEmoteInfo(emote, info);
                            console.log("Mousing out of ", emote);
                        };
                    })(emote, info);
                    
                    even = !even;
                    li.appendChild(menuItems);
                    el.appendChild(li);
                }
                return el;
            }
            catch (e)
            {
                console.log("makeEmoteList failed: " + e.message);
            }
        },
        searchEmotes: function(input)
        {
            this.searchResults = [];
            if (input == "")
            {
                this.resultsBox.innerHTML = '<li>Type something in the search box and hit "Enter".</li>';
                return;
            }
            for (emote in this.publicEmotes)
                if (emote.match(input))
                    this.searchResults.push(emote);
            this.searchResults.sort(function(a, b) {
                if (commentCloud.publicEmotes[a].votes === commentCloud.publicEmotes[b].votes) 
                    return a > b ? 1 : -1;
                else return commentCloud.publicEmotes[b].votes - commentCloud.publicEmotes[a].votes;
            });
            if (this.searchResults.length === 0)
                this.resultsBox.innerHTML = '<li>There are no results for "' + input + '".</li>';
            else
            {
                this.resultsBox.innerHTML = '<li>' + commentCloud.searchResults.length + ' results for "' + input + '"</li>';
                this.makeEmoteList(this.searchResults, this.resultsBox);
            }
        },
        // to make emote previews chase the mouse
        hoverAtMouse: function(e, imgNode, offset)
        {
            if (!offset) offset = 5;
            var pos = imgNode.parentNode.getBoundingClientRect(); // the position of the parentNode
            var leftPos = ((e.clientX - offset) - (pos.left + imgNode.width)) + 'px', topPos = ((e.clientY - offset) - (pos.top + imgNode.height)) + 'px';
            imgNode.style.left = leftPos; 
            imgNode.style.top = topPos;
        },
        // to add info to the emote menu item when hovering over it
        addEmoteInfo: function(emote, node)
        {
            //console.log("hovering over " + emote);
            var voteCountText = document.createElement('span');
            var voteButtons = document.createElement('span');
            var deviation = document.createElement('a');
            var voteCount = this.publicEmotes[emote].votes;
            
            var voteDownButton;
            var voteUpButton;
            var voteUp;

            voteButtons.setAttribute('class', 'vote-buttons');
            deviation.href = 'http://www.deviantart.com/deviation/' + this.publicEmotes[emote].devid;
            deviation.innerHTML = 'view';
            deviation.target = '_blank';
            
            if (this.publicEmotes[emote].myvote !== "0" || (this.votes[emote] !== null))
            {
                if (this.votes[emote] || this.publicEmotes[emote].myvote === "1")
                    voteUp = true;
                else if (!this.votes[emote] || this.publicEmotes[emote].myvote === "-1")
                    voteUp = false;
                voteUpButton = document.createElement('span');
                voteDownButton = document.createElement('span');
                (voteUp ? voteUpButton : voteDownButton).setAttribute('class', 'voted');
                if (this.votes[emote] !== undefined) voteCount = parseInt(voteCount) + (voteUp ? 1 : -1);
            }
            else
            {
                voteUpButton = document.createElement('a');
                voteUpButton.onclick = function() { commentCloud.voteOnEmote(emote, true, voteUpButton, voteDownButton, voteCountText); return false; };
                voteUpButton.href = '#';
                voteDownButton = document.createElement('a');
                voteDownButton.onclick = function() { commentCloud.voteOnEmote(emote, false, voteUpButton, voteDownButton, voteCountText); return false; };
                voteDownButton.href = '#';
            }
            
            voteUpButton.innerHTML = '+';
            voteDownButton.innerHTML = '-';
            
            voteCountText.innerHTML = voteCount + " votes";
            voteCountText.setAttribute('class', 'votecount');
            voteButtons.appendChild(voteCountText);
            voteButtons.appendChild(voteUpButton);
            voteButtons.appendChild(voteDownButton);
            voteButtons.appendChild(deviation);
            node.appendChild(voteButtons);
        },
        // to remove info from an emote menu item after moving the mouse from over it
        removeEmoteInfo: function(emote, node)
        {
            //console.log("moving off of " + emote, node);
            while (node.childNodes.length !== 0) { node.removeChild(node.childNodes[0]); /*console.log("removing child from " + emote + " info node...");*/ }
        },
        // sorts the list of emotes' names
        createEmoteImg: function(emote)
        {
            var img = document.createElement('img');
            var server = (Math.abs(crc32(this.publicEmotes[emote].img)) % 3) + 1;
            img.src = 'http://fc0' + server + '.deviantart.com/' + this.publicEmotes[emote].img;
            img.id = 'emote-' + this.publicEmotes[emote].devid; // currently unneeded
            img.onerror = function() { this.setAttribute('alt', 'deviation removed') };
            this.emoteNode.appendChild(img);
            return img;
        },
        sortEmotes: function (unorderedList) {
            try {
                var emoteList = {};
                var firstChar;

                for (var i = "a".charCodeAt(0); i < "z".charCodeAt(0) + 1; ++i)
                    emoteList[String.fromCharCode(i)] = [];
                emoteList['0'] = [];

                for (var x in unorderedList)
                {
                    if (unorderedList.hasOwnProperty(x))
                    {
                        if (x.match(/^:[a-zA-Z]/))
                            emoteList[x[1].toLowerCase()].push(x);
                        else emoteList['0'].push(x);
                    }
                }

                for (var i = "a".charCodeAt(0); i < "z".charCodeAt(0) + 1; ++i)
                    emoteList[String.fromCharCode(i)].sort();

                return emoteList;
            }
            catch (e)
            {
                console.log("sortEmotes: " + e.message);
                console.log("x = " + x);
            }
        },
        // sort all the emotes
        sortAllEmotes: function()
        {
            this.orderedEmotes.public = this.sortEmotes(this.publicEmotes);
            this.orderedEmotes.private = this.sortEmotes(this.privateEmotes);
        },
        // votes on the given emote; pass an emote object to it
        voteOnEmote: function(emote, voteUp, voteUpButton, voteDownButton, voteCount)
        {
            if (this.voteNodes[emote]) return; // if there's already a vote in progress for this emote, do nothing
            var emoteObj = this.publicEmotes[emote];
            this.votes[emote] = voteUp;
            this.voteNodes[emote] = {up: voteUpButton, down: voteDownButton, voteCount: voteCount};
            this.requests.push.votes = {payload: {deviation_id: emoteObj.devid, code: emote, vote: voteUp}, list: this.votes};
            this.requests.sendPush = true;
        },
        onVoteSuccess: function(success, payload, voteUp)
        {
            if (!success) alert('Failed to vote ' + payload.code + ' ' + voteUp ? 'up' : 'down');
            else
            {
                var emoteObj = this.publicEmotes[payload.code];
                var nodes = this.voteNodes[payload.code];
                var voteUpButton = document.createElement('span');
                var voteDownButton = document.createElement('span');
                voteUpButton.innerHTML = '+';
                voteDownButton.innerHTML = '-';
                (voteUp ? voteUpButton : voteDownButton).setAttribute('class', 'voted');
                nodes.up.parentNode.replaceChild(voteUpButton, nodes.up);
                nodes.down.parentNode.replaceChild(voteDownButton, nodes.down);
                nodes.voteCount.innerHTML = (parseInt(emoteObj.votes) + (voteUp ? 1 : -1)) + " votes";
            }
            delete this.voteNodes[payload.code]; // we'll no longer need this, so might as well delete it
        },
        // integrate Comment CLOUD into the commenting system
        integrateCommentCloud: function()
        {
            TalkPost.prototype.on_old = TalkPost.prototype.on;
            TalkPost.prototype.on = function()
            {
                try {
                    this.on_old();
                    // if it's a forum comment... necessary for the message center
                    if (this.comment.typeid === "18")
                    {
                        // don't add a duplicate link
                        if ($(this.node).find('.commentcloud-links')[0] == null)
                        {
                            var link = $(this.node).find('.emoticons')[0];
                            commentCloud.addCommentCloudLinks(link, "reply", $('.text', this.node)[0]);
                        }
                    }
                }
                catch (e)
                {
                    console.log("Error opening reply box: " + e.message)
                }
            };

            TalkPost.prototype.getText_old = TalkPost.prototype.getText;
            TalkPost.prototype.getText = function() {
                try {
                    var text = this.getText_old();
                    // if it's a forum comment...
                    if (this.comment.typeid === "18")
                    {
                        if (text.match(/:[^\s]+:/) !== null)
                        {
                            text = commentCloud.addEmotes(text);
                        }
                    }
                    return text;
                }
                catch (e)
                {
                    console.log("Error getting text: " + e.message);
                }
            };
            
            commentCloud.addCommentCloudLinks($('a.show_emoticons_modal')[0], $('#commentsubject')[0] ? "newthread" : "cooler", $('#commentbody')[0]);
        },
        // adds the extra links at the bottom of the comment boxes
        // currently the button styles don't work properly; why I have no idea
        addCommentCloudLinks: function(node, type, textbox)
        {
            var commentCloudLinks = document.createElement('div');
            commentCloudLinks.setAttribute('class', 'commentcloud-links');
            commentCloudLinks.style.display = 'inline';

            var menuLink = document.createElement('a');
            menuLink.href = '#';
            menuLink.innerHTML = 'Comment CLOUD Menu';
            menuLink.onclick = function()
            {
                try {
                    if ($('#commentcloud-modal')[0] == null)
                        commentCloud.showMenu(textbox);
                    return false;
                }
                catch (e)
                {
                    console.log("menuLink: " + e.message);
                }
            };
            
            var refreshLink = document.createElement('a');
            refreshLink.href = '#';
            refreshLink.innerHTML = 'Refresh Emote List';
            refreshLink.onclick = function() {
                commentCloud.refreshMenu = true;
                commentCloud.publicEmotes = {cloudError: 3};
                commentCloud.requests.pull.refreshedEmoteList = true;
                commentCloud.requests.sendPull = true;
                return false;
            }

            if (type == "newthread")
            {
                menuLink.classList.add('emoticons');
                refreshLink.classList.add('emoticons');
            }
            
            // If I just add it in the innerHTML, it screws up the first link
            
            var addSeparator = function()
            {
                var separatorNode = document.createElement('span');
                separatorNode.innerHTML = ' | ';
                commentCloudLinks.appendChild(separatorNode);
            }
            
            addSeparator();
            commentCloudLinks.appendChild(menuLink);
            addSeparator();
            commentCloudLinks.appendChild(refreshLink);
           
            node.parentNode.insertBefore(commentCloudLinks, node.nextSibling);
            
            if (type === "cooler") // the big reply box, #cooler-comment-submit
            {
                // this keeps clicking on the links with an empty commenting box from
                // making the commenting box lose focus
                (function() {
                    // no point in calculating this more than once, ergo, use a closure
                    var gmi = GMI.up(node);
                    commentCloudLinks.onmouseover = function() { gmi.moodHover(); };
                    commentCloudLinks.onmouseout = function() { gmi.moodOut(); };
                })();
            }
        },
        // replaces the emote codes with thumbnails in the given text
        addEmotes: function(text)
        {
            if (commentCloud.publicEmotes.cloudError)
            {
                console.log("Cannot add emotes:\n\n"+commentCloud.publicEmotes.cloudError);
            }
            else for (var emote in commentCloud.publicEmotes)
            {
                // escape all characters that could be interpreted as regex
                var escapedEmote = emote.replace(/[.*+?^${}()|[\]\/\\]/g, "\\$0");
                text = text.replace(
                    new RegExp(escapedEmote, 'g'),
                    ':thumb' + commentCloud.publicEmotes[emote].devid + ':'
                );
            }
            return text;
        },
        // this performs EVERYTHING involving the Comment CLOUD set up, unlike the above
        initialize: function() {
            commentCloud.addStyle();
            commentCloud.integrateCommentCloud();
        },
    }
    // now let's put this thing to use!
    commentCloud.initialize();

    // comes from the dAmn client source code 
    (function() { 
        var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";     
     
        /* Number */ 
        crc32 = function( /* String */ str, /* Number */ crc ) { 
            if( crc === window.undefined ) crc = 0; 
            var n = 0; //a number between 0 and 255 
            var x = 0; //an hex number 
     
            crc = crc ^ (-1); 
            for( var i = 0, iTop = str.length; i < iTop; i++ ) { 
                n = ( crc ^ str.charCodeAt( i ) ) & 0xFF; 
                x = "0x" + table.substr( n * 9, 8 ); 
                crc = ( crc >>> 8 ) ^ x; 
            } 
            return crc ^ (-1); 
        }; 
    })();
}

// this object will put the Comment CLOUD script on the content page and allow
// it to interact with the results of using Greasemonkey's API
// TODO: Make this use postMessage() instead of unsafeWindow for Chrome compatibility?
//
// Here's a better idea: use the JSONP interface and localStorage INSIDE the content scope
// like you should have in the beginning instead of this hacktastic polling crap
// It will make the logic simpler across the board as well, and TamperMonkey will
// no longer be necessary to use this script. EVERYBODY WINS!
// I can't even remember WHY I didn't use JSONP in the first place.

commentCloudController = {
    interval: 0, // the ID of the interval to run this.checkStorageRequests()
    addCommentCloudScript: function() {
        var script = document.createElement('script');
        script.id = "commentCloudScript";
        script.type = "text/javascript";
        script.textContent = "(" + commentCloudScript + ")();";
        document.getElementsByTagName('head')[0].appendChild(script);
    },
    // this constructs a request to the Emote Cloud server and executes a callback
    // once the JSON from the server is recieved. The constructed JSON object
    // is the first argument to the callback
    callAPI: function(page, options) {
        try {
            options.url = 'http://www.thezikes.com/' + page + '.php?format=json'; // even for POST requests, you must use a url like this
            var payload = [];
            if (!options.payload) options.payload = {};
            if (options.payload) for (var x in options.payload) if (options.payload.hasOwnProperty(x) && options.payload[x] !== null) payload.push(x + '=' + options.payload[x]);
            if (options.method === 'GET')
                options.url += '&' + payload.join('&');
            else if (options.method === 'POST')
            {
                options.data = payload.join('&');
                options.headers = {"Content-Type": "application/x-www-form-urlencoded"}
            }
            delete options.payload;
            //options.onerror = function() { alert("Couldn't make API request to " + page + "!") }
            console.log(options);
            GM_xmlhttpRequest(options);
        }
        catch (e) { console.log("Couldn't make API call!" + e) }
    },
    // NOTE: getValue and setValue currently have redundant functionality, and will possibly not
    // even use localStorage later...
    // this gets a saved value using whatever construct is most appropriate for the browser
    getValue: function(item, defaultValue) {
        if (GM_getValue) return GM_getValue(item, defaultValue);
        else if (localStorage)
        {
            var value = localStorage.getItem(item);
            return (value !== null ? value : defaultValue);
        }
    },
    // this saves a value using whatever construct is most appropriate for the browser
    setValue: function(item, newValue) {
        if (GM_setValue) 
        {
            GM_setValue(item, newValue);
        }
        else if (localStorage)
        {
            localStorage.setItem(item, newValue);
        }
    },
    insertEmoteList: function(refreshList, forceLoad, ip) {
        console.log("Running insertEmoteList...");
        var emoteLoader = document.createElement('script');
        emoteLoader.id = "commentCloudPublicEmotes";
        emoteLoader.type = "text/javascript";
        
        // if there's an error, then the object will have a cloudError attribute
        // which will tell the script in the content page what went wrong
        emotes = '{"cloudError": 1}';
        try
        {
            if (refreshList || forceLoad)
            {
                if (!this.getValue("commentcloud_public_emotes"))
                    console.log("Loading emote list because it's empty!");
                else if (forceLoad)
                    console.log("Loading emote list because of forced load!");
                else console.log("We're loading the emote list using magic!");
                this.callAPI("publicemotes", {
                    onload: function(data) {
                        try {
                            emotes = (data.responseText || '{"cloudError": 2}');
                            commentCloudController.setValue("commentcloud_public_emotes", emotes);
                            if (forceLoad)
                            {
                                // if you're forcing a reload, then the votes will need to be reset
                                // because the Emote Cloud will update us on what we've voted for
                                // and the information will be redundant or even wrong
                                commentCloudController.setValue("commentcloud_votes", "{}");
                                commentCloudController.loadVotes();
                            }
                            commentCloudController.loadPublicEmoteList(false); // inject the list of emotes
                            if (forceLoad) alert("Emote list has been refreshed.");
                        }
                        catch(e) { alert("Error loading emote list! " + e) }
                    },
                    method: 'GET',
                    payload: {ip: ip}
                });
            }
            else emotes = this.getValue("commentcloud_public_emotes", '{"cloudError": 3}');
        }
        catch (e)
        {
            emotes = '{"cloudError": "' + e.message.replace(/"/g, '\\"') + '"}';
        }
        emoteLoader.innerHTML = "commentCloud.publicEmotes = JSON.parse('" + emotes.replace(/'/g, "\\'") + "')";
        // add it to the page
        document.getElementsByTagName('head')[0].appendChild(emoteLoader);
    },
    loadPublicEmoteList: function(forceLoad)
    {
        // the fact of the matter is that one way or another, you need to get the
        // ip address of the client set as a variable in the request if you want
        // to get a public emotes list with the proper votes set back
        // according to =zachriel, the guessed ip address was normally wrong
        // so you need to specify it manually... how annoying
        //
        // NOT ONLY THAT, BUT IT DOESN'T FUCKING WORK AND THEY HAVE NO IDEA HOW TO FIX IT
        // I don't even know if I should bother keeping the IP resolving part now!
        console.log("Begin loading public emote list...");
        if (!this.getValue("commentcloud_public_emotes") || forceLoad)
        {
            console.log("Running request for ifconfig.me...");
            GM_xmlhttpRequest({
                url: 'http://ifconfig.me/ip',
                method: 'GET',
                onload: function(data) {
                    console.log("Got IP address: (data)", data.responseText);
                    commentCloudController.insertEmoteList(true, forceLoad, data.responseText.replace(/\n/, ''));
                },
                onerror: function(data) {
                    console.log("Failed to obtain the IP address. Loading without IP...");
                    commentCloudController.insertEmoteList(true, forceLoad);
                }
            });
        }
        else this.insertEmoteList(false, forceLoad);
        console.log("Done loading public emote list...");
    },
    // the emote list should be removed before it's reloaded
    unloadPublicEmoteList: function() {
        var emoteLoader = document.getElementById("commentCloudPublicEmotes");
        emoteLoader.parentNode.removeChild(emoteLoader);
    },
    loadVotes: function() {
        var votesLoader = document.createElement('script');
        votesLoader.innerHTML = "commentCloud.votes = JSON.parse('" + this.getValue("commentcloud_votes", '{}').replace(/'/g, "\\'") + "')";
        votesLoader.id = 'commentCloudVotes';
        document.getElementsByTagName('head')[0].appendChild(votesLoader);
    },
    voteOnEmote: function(payload, voteUp) {
        var url = 'vote' + (voteUp ? 'up' : 'down');
        this.callAPI(url, {
            payload: payload,
            onload: function() { commentCloudController.onVoteSuccess(true, payload, voteUp); },
            onerror: function() { commentCloudController.onVoteSuccess(false, payload, voteUp); },
            method: 'POST'
        });
    },
    onVoteSuccess: function(success, payload, voteUp) {
        // this simply runs a single function in the content page scope, which
        // tells the page that the vote worked or failed
        var voteResponse, callback;
        if (voteResponse = document.getElementById('commentCloudVoteCallback')) voteResponse.parentNode.removeChild(voteResponse);
        voteResponse = document.createElement('script');
        voteResponse.type = 'text/javascript';
        callback = 'commentCloud.onVoteSuccess(';
        callback += (success ? 'true' : 'false') + ', ';
        callback += JSON.stringify(payload) + ', ';
        callback += (voteUp ? 'true' : 'false') + ');';
        voteResponse.innerHTML = callback; 
        voteResponse.id = 'commentCloudVoteCallback';
        document.getElementsByTagName('head')[0].appendChild(voteResponse);
    },
    // see if the script in the content page wants to push or pull something
    // NOTE: Some of the push/pull requests are pointless for anything besides testing
    checkStorageRequests: function() {
        if ($w.commentCloud && $w.commentCloud.requests)
        {
            requests = $w.commentCloud.requests;
            if (requests.sendPush)
            {
                var items = requests.push;
                if (items.publicEmotes) // this allows me to change the public emotes for testing
                    this.setValue("commentcloud_public_emotes", JSON.stringify(items.publicEmotes));
                if (items.settings) // not used yet, but possibly in the future
                    this.setValue("commentcloud_settings", JSON.stringify(items.settings));
                if (items.deleteEmoteList) // unless you're me, you'll never need to use this
                {
                    GM_deleteValue("commentcloud_public_emotes");
                    alert("Emote list deleted.");
                    items.deleteEmoteList = false;
                }
                if (items.votes) // this makes a vote on the emote cloud and adds it to the database
                {
                    this.setValue("commentcloud_votes", JSON.stringify(items.votes.list));
                    if (items.votes.payload)
                    {
                        var payload = items.votes.payload;
                        // the vote attribute is separated from the payload object before use in callAPI()
                        // as "vote" is not an form attribute in the actual payload to voteup.php/votedown.php
                        var voteUp = payload.vote;
                        delete payload.vote;
                        this.voteOnEmote(payload, voteUp);
                    }
                }
                requests.sendPush = false;
            }
            if (requests.sendPull)
            {
                if (requests.pull.publicEmotes)
                    requests.pull.publicEmotes = JSON.parse(
                        this.getValue("commentcloud_public_emotes", '{"cloudError": "nothing to pull"}')
                    );
                if (requests.pull.settings)
                    requests.pull.settings = JSON.parse(
                        this.getValue("commentcloud_settings", '{"cloudError": "nothing to pull"}')
                    );
                if (requests.pull.refreshedEmoteList)
                {
                    this.unloadPublicEmoteList();
                    this.loadPublicEmoteList(true);
                    requests.pull.refreshedEmoteList = false;
                }
                if (requests.pull.votes)
                {
                   this.loadVotes();
                   requests.pull.votes = false;
                }
                requests.sendPull = false;
            }
        }
    },
    // this is what the script controller should do on startup
    initialize: function() {
        console.log("addCommentCloudScript()");
        this.addCommentCloudScript();
        console.log("insertPublicEmoteList()");
        this.loadPublicEmoteList();
        console.log("loadVotes()");
        this.loadVotes();
        console.log("setInterval()");
        this.interval = setInterval(
            function(){ commentCloudController.checkStorageRequests() },
            500
        );
    }
}

// it's time to HEAT THINGS UP
try {
    commentCloudController.initialize();
}
catch (e)
{
    console.log("Couldn't initialize Comment CLOUD:", e);
}
