// -*- js-indent-level: 2 -*-
// -*- js2-basic-offset: 2 -*-
(function (root, factory) {
  root.Index = factory(root);
  console.log("Document is ready");
}(this, function(root) {
  'use strict';
  var document = root.document;
  var Index = {};
  // More info about config & dependencies:
  // https://revealjs.com/config/
  Reveal.initialize({

	// Factor of the display size that should remain empty around the content
	margin: 0.04,

    center : true,
    overview: true,

    // Flags whether to include the current fragment in the URL,
    // so that reloading brings you to the same fragment position
    fragmentInURL: false,

    transition : "fade",
    history : true,
    slideNumber: 'c/t',
    controls: false,
    showNotes: false,
    dependencies: [
      { src: 'reveal.js/plugin/markdown/markdown.js' },
      { src: 'reveal.js/plugin/notes/notes.js', async: true },
      { src: 'socket.io.js', async: true },
      // { src: 'reveal.js/plugin/multiplex/master.js', async: true },
      // and if you want speaker notes
      // { src: 'reveal.js/plugin/notes-server/client.js', async: true }
    ],
    math : {
        mathjax: "./MathJax/es5/tex-chtml-full.js"
    },
    keyboard: {
      38: 'prev', // prev on key down
      40: 'next', // next on key up
    },
    hideInactiveCursor: false,
    multiplex: {
        // Example values. To generate your own, see the socket.io server instructions.
        "secret": "15428297917341906458",
        "id":"4308ad89fe2e7d3f",
        url: 'http://fovea.eecs.umich.edu:1948' // Location of socket.io server
    },

	plugins: [ RevealMarkdown, RevealMenu, RevealHighlight, RevealChalkboard, RevealAudioSlideshow, RevealAudioRecorder ],
  });

  var safeGetElemementById = function (parent, id) {
      var svg = parent.getElementById(id) || console.error("Bad id ", id);
      return svg;
  };

  var safeContentDocument = function (ele) {
      try {
          var svgdoc = ele.contentDocument;
      }
      catch(e) {
          svgdoc = ele.getSVGDocument();
      }
      if ( ! svgdoc)
          console.error("Cannot get svgdoc. Maybe replace file:// with http://");
      return svgdoc;
  };

  Index.getSVGObjElementById = function (svg_ele, ele_id) {
    var ele = safeGetElemementById(safeContentDocument(svg_ele), ele_id);
    return ele;
  };

  Index.getSVGElementById = function (svg_id, ele_id) {
    return Index.getSVGObjElementById(safeGetElemementById(document, svg_id),
      ele_id);
  };

  Index.makeAppear = function (svg_id, ele_id) {
      return [
          function (svg) {
              Index.getSVGElementById(svg_id, ele_id).style["display"] = "inherit";
          },
          function (svg) {
              Index.getSVGElementById(svg_id, ele_id).style["display"] = "none";
          }
      ];
  };

  Index.makeDisappear = function (svg_id, ele_id) {
      return [
          function (svg) {
              Index.getSVGElementById(svg_id, ele_id).style["display"] = "none";
          },
          function (svg) {
              Index.getSVGElementById(svg_id, ele_id).style["display"] = "inherit";
          }
      ];
  };

  Index.makeSwap = function (svg_id, ele_out, ele_in) {
      return [
          function (_) {
              var svg = safeContentDocument(safeGetElemementById(document, svg_id));
              safeGetElemementById(svg, ele_in).style["display"] = "inherit";
              safeGetElemementById(svg, ele_out).style["display"] = "none";
          },
          function (_) {
              var svg = safeContentDocument(safeGetElemementById(document, svg_id));
              safeGetElemementById(svg, ele_in).style["display"] = "none";
              safeGetElemementById(svg, ele_out).style["display"] = "inherit";
          }
      ];
  };

  Index.forSVGElementById = function (svg_id, element_ids, per_ele_func) {
      element_ids.forEach(function (ele_id) {
          var svg = document.getElementById(svg_id) || console.error("Bad svg_id", svg_id);
          var ele = Index.getSVGObjElementById(svg, ele_id) || console.error("Bad ele_id", ele_id);
          per_ele_func(ele);
      });
  };

  Reveal.addFragmentListner = function (
    fragment_id,
    on_fragment_shown, on_fragment_hidden)
  {
    Reveal.addEventListener("fragmentshown", function(e) {
      Array.from(e.fragments).forEach(function (frag) {
        if (frag.id == fragment_id)
          on_fragment_shown(frag);
      });
    }, false);
    Reveal.addEventListener("fragmenthidden", function(e) {
      Array.from(e.fragments).forEach(function (frag) {
        if (frag.id == fragment_id)
          on_fragment_hidden(frag);
      });
    }, false);
  };

  // *************************************************************
  // Handle videos inside fragments
  // *************************************************************
  var getTagChildren = function (element, tag_name, class_name) {
    var videles;
    if (element.tagName.toUpperCase() == tag_name.toUpperCase()) {
      videles = [element];
    } else {
      videles = Array.from(element.getElementsByTagName(tag_name));
    }
    if (class_name)
      videles = videles.filter(
          function (v) { return v.classList.contains(class_name); });
      return videles;
  };


  // Pause and play videos on slide change
  var pauseVideo = function (element) {
    getTagChildren(element, "video").forEach(function (pvidele) {
      console.log("Pausing : " + pvidele.id);
      pvidele.pause();
    });

    getTagChildren(element, "iframe").forEach(function (pvidele) {
      pvidele.contentWindow.postMessage(
        '{"event":"command","func":"' + 'stopVideo' + '","args":""}', '*'); 
    });
  };

  var parseURIFragments = function (uri) {
      var dummya = document.createElement("a");
      dummya.href = uri;
      var hash = dummya.hash;
      var fragments = {};
      if (hash) {
          hash.slice(1).split("&").forEach(function (fragstr) {
              var parts = fragstr.split("=");
              fragments[parts[0]] = parts[1];
          });
      }
      return fragments;
  };

  var parseVideoStartTime = function (videle) {
      var fragments = parseURIFragments(videle.children[0].src);
      var starttime = 0;
      if (fragments["t"]) {
          var startend = fragments["t"].split(",");
          starttime = parseInt(startend[0]);
      }
      return starttime;
  };

  // Keep a record of previously played videos and pause them before
  // playing the next set of videos.
  var PLAY_ON_FRAGMENT_CLASS = "fragment-play";
  var previously_played_videos = [];
  var resetAndPlayVideo = function (element) {
    getTagChildren(element, "video", PLAY_ON_FRAGMENT_CLASS).forEach(function (videle) {
      videle.pause();

      if (videle.hasAttribute("data-playbackRate")) {
        videle.playbackRate = parseFloat(videle.getAttribute("data-playbackRate"));
        // console.log("Playing : " + videle.id + " at rate: " + videle.playbackRate);
      }
      videle.currentTime = parseVideoStartTime(videle);
      // console.log("Playing : " + videle.id + " from: " + videle.currentTime);
      if ( ! videle.classList.contains("pause") ) {
        videle.play();
      }
      previously_played_videos.push(videle);
    });

    getTagChildren(element, "iframe", PLAY_ON_FRAGMENT_CLASS).forEach(function (videle) {
      if ( ! videle.classList.contains("pause") ) {
        videle.src += "&autoplay=1";
      }
    });
  };
  Reveal.addEventListener( 'fragmentshown',
                           function (e) {
                             previously_played_videos.forEach(
                               function (vid) { vid.pause() });
                             previously_played_videos = [];
                             Array.from(e.fragments).forEach(resetAndPlayVideo);
                           } );
  Reveal.addEventListener( 'fragmenthidden',
                           function ( e ) {
                             console.log("fragmenthidden " + e.fragment.id);
                             e.fragments.forEach(pauseVideo);
                           }, false);
  Reveal.addEventListener( 'slidechanged',
                           function ( e ) {
                             if (e.previousSlide)
                               pauseVideo(e.previousSlide);
                             if (e.currentSlide)
                                 Array.from(
                                     e.currentSlide.querySelectorAll("video.slide-play")
                                 ).forEach(function (v) {
                                     v.pause();
                                     v.currentTime = parseVideoStartTime(v);
                                     console.log("Playing : " + v.id + " from: " + v.currentTime);
                                     v.play();
                                 });
                           });

  // *************************************************************
  // End of handling videos inside fragments
  // *************************************************************

  // Handle footnotes and citations
  Reveal.addEventListener( 'slidechanged', function( event ) {
    // event.previousSlide, event.currentSlide, event.indexh, event.indexv
    var footerele = document.getElementById("footer");
    footerele.innerHTML = "";
    // var citelist = Array.from(event.currentSlide.getElementsByTagName("cite"));
    var citelist = [];
    var footnotelist = Array.from(
          event.currentSlide.getElementsByTagName("footnote") || []).concat(citelist);
    var rightfootnotestrings = [];
    var leftfootnotestrings = [];
    footnotelist.forEach(function(fnl) {
      var key = fnl.getAttribute("data-key");
      var value = fnl.innerHTML;
      if ( ! value && key ) value = key;
      var href_str = "";
      if (key) href_str = "href='#/bibliography-slide'";
      var citeplace = fnl.getAttribute("data-place") || "right";
        var citationhtml = "<span " + href_str + ">"
            + value.replace(" ", "&nbsp;") + "</span>";
      if (citeplace == "left") {
          leftfootnotestrings.push(citationhtml);
      } else {
          rightfootnotestrings.push(citationhtml);
      }
    });
      footerele.innerHTML = "<div>" + "&nbsp;" + leftfootnotestrings.join(", ")
          + "</div>" + "<div>" + "&nbsp;" + rightfootnotestrings.join(", ") +
          "</div>";
  } );

  // handle slide numbering
  /**
    * Applies HTML formatting to a slide number before it's
    * written to the DOM.
    *
    * @param {number} a Current slide
    * @param {string} delimiter Character to separate slide numbers
    * @param {(number|*)} b Total slides
    * @return {string} HTML string fragment
    */
  function formatSlideNumber( a, delimiter, b ) {

      if( typeof b === 'number' && !isNaN( b ) ) {
          return '<span class="slide-number-a">'+ a +'</span>' +
              '<span class="slide-number-delimiter">'+ delimiter +'</span>' +
              '<span class="slide-number-b">'+ b +'</span>';
      }
      else {
          return '<span class="slide-number-a">'+ a +'</span>';
      }

  }

  Reveal.addEventListener( 'slidechanged', function (event) {
      // event.previousSlide, event.currentSlide, event.indexh, event.indexv
      // Skip title slide numbering
      var slide_num_str = slide_num_str = formatSlideNumber(
          event.indexh + 1, '/', Reveal.getTotalSlides() );
      var onSlideNumberElement = document.getElementById( 'slide-number-container' );
      onSlideNumberElement.classList.add('on-slide-number');
      onSlideNumberElement.innerHTML = slide_num_str;
      if (event.indexh <= 0) {
          onSlideNumberElement.style["opacity"] = 0;
      }
  });

  // Handle svg capturing the keypress and mouse press events
  var bubbleSVGEvent = function (obj) {
      var events = ["mouseup", "click", "mousedown", "keypress", "keydown", "keyup"];
        events.forEach(function (eventname) {
            safeContentDocument(obj).documentElement.addEventListener(
                eventname, function (e) {
                    var new_event = new e.constructor(e.type, e);
                    obj.dispatchEvent(new_event);
                });
        });
  };
  (// bubbleSVGEvent for all object tags
      function () {
          Array.from(document.getElementsByTagName("object")).forEach(function (obj) {
              obj.addEventListener("load", function (loadevent) {
                  bubbleSVGEvent(obj);
              });
          });
      }()
  );

  (// Handle citations to add to bibliography in the end
    function () {
      var added = {};
      Array.from(document.getElementsByTagName("cite")).forEach(
        function (fnl) {
          var key = fnl.getAttribute("data-key");
          if ( ! (key in added) ) {
            var citation = document.getElementById(key);
            if (citation) {
              document.getElementById("bibliography").innerHTML += 
                "<li>" + key
                + " &nbsp;&nbsp;:&nbsp;&nbsp; " + citation.innerHTML
                + "</li>";
              added[key] = 1;
            } else {
              console.error("Citation not found for " + key);
            }
          }
        });
    }());

    var nullsplit = function (str, sep) {
        if (str) {
            return str.split(sep);
        } else {
            return [];
        }
    };
    Index.mapDummyFragments = function (parentid, svgid) {
        var dummyfragments = document.getElementById(parentid).children;
        Array.from(dummyfragments).forEach(function (frag) {
            var svgeleinids = nullsplit(frag.getAttribute("svg-ele-in-ids"), " ");
            var svgeleoutids = nullsplit(frag.getAttribute("svg-ele-out-ids"), " ");
            var alleleids = svgeleinids.concat(svgeleoutids);
            var fragid = frag.id || parentid.concat("-", alleleids.join("-"));
            frag.id = fragid;
            var style_in = frag.getAttribute("style-in") || "display:inherit";
            var style_out = frag.getAttribute("style-out") || "display:none";
            Reveal.addFragmentListner(
                frag.id,
                function (f) {
                    var svg = safeContentDocument(safeGetElemementById(document, svgid));
                    svgeleinids.forEach(function (eleid) {
                        // fragment shown
                        var svgele = safeGetElemementById(svg, eleid);
                        console.log(eleid, " shown in style_in: ", style_in);
                        svgele.style.cssText = style_in;
                    });
                    svgeleoutids.forEach(function (eleid) {
                        // fragment shown forward
                        var svgele = safeGetElemementById(svg, eleid);
                        console.log(eleid, " shown out style_out: ", style_out);
                        svgele.style.cssText = style_out;
                    });
                },
                function (f) {
                    var svg = safeContentDocument(safeGetElemementById(document, svgid));
                    svgeleinids.forEach(function (eleid) {
                        // fragment hidden
                        var svgele = safeGetElemementById(svg, eleid);
                        console.log(eleid, " hidden in style_out: ", style_out);
                        svgele.style.cssText = style_out;
                    });
                    svgeleoutids.forEach(function (eleid) {
                        // fragment hidden
                        var svgele = safeGetElemementById(svg, eleid);
                        console.log(eleid, " hidden out style_in: ", style_in);
                        svgele.style.cssText = style_in;
                    });
                }
            );
        });
    };

  // Map dummy-to-svg-map
    root.addEventListener("load", function () {
        var dummies = document.querySelectorAll("[mapped-svg]");
        Array.from(dummies).forEach(function (dummy) {
            var mappedsvg = dummy.getAttribute("mapped-svg")
                || console.error("needs mapped-svg");
            // console.log("mapping dummy ", dummy.id, " to svg ", mappedsvg);
            Index.mapDummyFragments(dummy.id, mappedsvg);
        });
    });

    // Show chapter progress
    root.addEventListener("load", function () {
        var chapter_footer = document.getElementById("footer-chapter-progress");
        if (! chapter_footer ) return;
        var activestyle = chapter_footer.getAttribute("activestyle")
            || console.error("need activestyle in footer-chapter-progress");
        var inactivestyle = chapter_footer.getAttribute("inactivestyle")
            || console.error("need activestyle in footer-chapter-progress");
        // console.log("activestyle ", activestyle, " inactivestyle ", inactivestyle);
        var chapter_progress_next = document.querySelectorAll(".slides>section");
        var chapter_progress_thresholds = Array.from(chapter_progress_next).map(
            (section, i) => [section, i]
        ).filter(
            section_i => section_i[0].getAttribute("chapter-progress-next") != null
        ).map(
            section_i => section_i[1]
        );
        // console.log("chapter_progress_thresholds", chapter_progress_thresholds);
        var chapter_progress = document.querySelectorAll(".chapter-progress");
        Reveal.addEventListener("slidechanged", function (event) {
            Array.from(chapter_progress).map(function (chapter, count) {
                // event.previousSlide, event.currentSlide, event.indexh, event.indexv
                var high = count+1 < chapter_progress_thresholds.length ?
                    chapter_progress_thresholds[count+1]
                    : Reveal.getTotalSlides();
                // console.log(high, " > ", event.indexh, " >= ", chapter_progress_thresholds[count]);
                if (event.indexh >= chapter_progress_thresholds[count]
                    && event.indexh < high) {
                    chapter.style.cssText = activestyle;
                } else {
                    chapter.style.cssText = inactivestyle;
                }
                if (chapter_progress_thresholds[0] <= event.indexh &&
                    event.indexh < chapter_progress_thresholds.slice(-1)[0]) {
                    chapter_footer.style["opacity"] = 1;
                } else {
                    chapter_footer.style["opacity"] = 0;
                }
            });
        });
    });

  // Handle title repetition
  Array.from(document.getElementsByClassName("presentationtitle")).forEach(
    function (pttl) {
    pttl.innerHTML = document.presentationtitle;
  });

  // Handle author repetition
  Array.from(document.getElementsByClassName("presentationauthor")).forEach(
    function (pa) {
    pa.innerHTML = document.presentationauthor;
  });

  Array.from(document.getElementsByClassName("copy-of")).forEach(
    function (copy) {
      if (copy.hasAttribute("data-copy-of")) {
        var copy_of = document.getElementById(copy.getAttribute("data-copy-of"));
        Array.from(copy_of.childNodes).forEach(function (child) {
            copy.appendChild(child.cloneNode(true));
        });
      }
    });

  // remove hidden slides from the slide deck
  (function () {
    var slidedeck = document.querySelectorAll(".reveal .slides")[0];
    Array.from(slidedeck.getElementsByClassName("hideslide")).forEach(
      function (slide) {
        console.log("Removed slide " + slide.id);
        slidedeck.removeChild(slide);
      });
  });

  // If you change the order of slides dynamically, we need to sync the slides with Reveal
  return Index;
}));
