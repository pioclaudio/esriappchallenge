require([
    // ArcGIS
    "esri/Map",
    "esri/views/MapView",

    // Widgets
    "esri/widgets/Home",
    "esri/widgets/Zoom",
    "esri/widgets/Search",
    "esri/widgets/ScaleBar",
    "esri/widgets/Attribution",

    "esri/Graphic",
    "esri/tasks/Locator",
    "esri/tasks/RouteTask",
    "esri/tasks/support/RouteParameters",
    "esri/tasks/support/FeatureSet",
    "esri/tasks/ServiceAreaTask",
    "esri/tasks/support/ServiceAreaParameters",
    "esri/request",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/geometry/support/webMercatorUtils",
    "esri/geometry/projection",

    // Bootstrap
    "bootstrap/Collapse",
    "bootstrap/Dropdown",
    "bootstrap/Tab",

    // Calcite Maps
    "calcite-maps/calcitemaps-v0.10",
    // Calcite Maps ArcGIS Support
    "calcite-maps/calcitemaps-arcgis-support-v0.10",

    "dijit/form/TimeTextBox",
    "dojo/query",
    "dojo/domReady!"
], function (Map, MapView, Home, Zoom, Search, ScaleBar, Attribution,
             Graphic, Locator, RouteTask, RouteParameters, FeatureSet, ServiceAreaTask, ServiceAreaParameters,
             esriRequest, GraphicsLayer, FeatureLayer, webMercatorUtils, projection,
             Collapse, Dropdown, Tab, CalciteMaps, CalciteMapArcGISSupport, TimeTextBox, query) {
    //esri.widgets.Search.main.placeholder = "Type address, or click on the map";
    //document.getElementById("searchWidget_input").placeholder = "Search Location";
    /******************************************************************
     *
     * Create the map, view and widgets
     *
     ******************************************************************/

    var tabMode = 0;

    var routeLayer = new GraphicsLayer();
    // Map
    // var samplePointsLayer = new FeatureLayer({
    //     url: "https://services.arcgis.com/4TKcmj8FHh5Vtobt/arcgis/rest/services/Toronto_Neighborhood/FeatureServer/0?token=qIqNnGzb1_pJJtTBEKiD3jDjbruo81X8HFvrYC2EhZ55iizDpQkdwa8BJXEjWVMt4Z-C8fb_C1FWY_gP1vDczmJWnM7rlv31v257XVNTwiKjqT-1tIzzafldzKv-lUQAxIRdlGpO6dmtsR_UuwZuoCP43-TyZNhR7EoLOh3x7z2GnOW-7_nhdUUfN-it1i8biYGKx1TJzePefFdObKGIlc2bCkMCwwDv2lNvone7pAU46BD2AIBOnCz-JFic8AhX"
    // });
    var neighborhoodLayer = new FeatureLayer({
        url: "https://services.arcgis.com/4TKcmj8FHh5Vtobt/arcgis/rest/services/Vancouver/FeatureServer/0?token=3Dr9irqog4DQEVktNkSqZAD29MRUuIUj9Xb0ua9_SGGRaFm_KPXbW879n9CYurh7UE_P4V2trOvLHvFs6pKSLdyi30OLF-mnXeABH6r81EV4CYkXQdClK1iDF0i18dRoLiaZpWSZ1Ohak1HRLP8bKll0kWzvwUnGmH5tNR_zJDsHAHrLYl8lY_TVWBen6JdgGWlv9zsdY_7crEd4yfpUVQ.."
    });
    var map = new Map({
        basemap: "dark-gray-vector",
        layers: [routeLayer, neighborhoodLayer] // Add the computeRoute layer to the map
    });

    // View
    var mapView = new MapView({
        container: "mapViewDiv",
        map: map,
        zoom: 11, // Sets zoom level based on level of detail (LOD)
        //center: [-79.4163, 43.70011], // Sets center point of view using longitude,latitude
        center: [-123.116226, 49.246292],
        padding: {
            top: 50,
            bottom: 0
        },
        ui: {components: []}
    });


    var polyCentroids;
    var transitTimeArray = [];
    var drivingTimeArray = [];
    var diffTimeArray = [];
    var transitTimeSingle = 0;
    var drivingTimeSingle = [];
    // Popup and panel sync
    mapView.when(function () {
        CalciteMapArcGISSupport.setPopupPanelSync(mapView);
        query('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            tabMode = query('a[data-toggle="tab"]').indexOf(this);
            mapView.graphics.removeAll();
            routeLayer.graphics.removeAll();
            srcGraphic = 0;
            dstGraphic = 0;
        })

        neighborhoodLayer.queryFeatures().then(function(results){
            // prints an array of all the features in the service to the console
            polyCentroids = results.features.map(function(feature) {
                //return feature.geometry;
                return feature.geometry.centroid;
            });
        });
    });

    var srcSearchWidget = new Search({
        container: "SrcInput",
        view: mapView,
        locationEnabled: false,
        autoSelect: false,
        placeholder: "Choose origin point, or click on the map"
    });
    var dstSearchWidget = new Search({
        container: "DstInput",
        view: mapView,
        locationEnabled: false,
        autoSelect: false
    });

    // var timeText = new TimeTextBox({
    //     name: "progval", value: new Date(),
    //     constraints: {
    //         timePattern: 'HH:mm:ss',
    //         clickableIncrement: 'T00:15:00',
    //         visibleIncrement: 'T00:15:00',
    //         visibleRange: 'T01:00:00'
    //     }
    // }, "progval").startup();


    // Map widgets
    var home = new Home({
        view: mapView
    });
    mapView.ui.add(home, "top-left");

    var zoom = new Zoom({
        view: mapView
    });
    mapView.ui.add(zoom, "top-left");


    var scaleBar = new ScaleBar({
        view: mapView
    });
    mapView.ui.add(scaleBar, "bottom-left");

    var attribution = new Attribution({
        view: mapView
    });
    mapView.ui.add(attribution, "manual");

    var srcGraphic, dstGraphic;
    var srcDropPinActive = false;
    var dstDropPinActive = false;

    // Create a symbol for drawing the point
    var srcMarkerSymbol = {
        type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
        color: "#DC143C",
        outline: {
            // autocasts as new SimpleLineSymbol()
            color: [255, 255, 255],
            width: 2
        }
    };
    var dstMarkerSymbol = {
        type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
        color: "#228B22",
        outline: {
            // autocasts as new SimpleLineSymbol()
            color: [255, 255, 255],
            width: 2
        }
    };
    var routeSymbol = {
        type: "simple-line", // autocasts as SimpleLineSymbol()
        color: [255, 255, 255, 0.5],
        width: 5
    };

    mapView.on("click", function (event) {
        switch (tabMode) {
            case 0:
                addGraphic(event.mapPoint);
                break;
            case 1:
                computeServiceArea(event.mapPoint);
                break;
            case 2:
                //ODMatrix(event.mapPoint);
                diffODMatrix(event.mapPoint);
                break;
        }

    });


    var locatorTask = new Locator({
        url:
            "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
    });
    var routeTask = new RouteTask({
        url:
            "https://utility.arcgis.com/usrsvcs/appservices/skHSU1JsOEZauhMu/rest/services/World/Route/NAServer/Route_World/solve"
    });
    // Setup the computeRoute parameters
    var routeParams = new RouteParameters({
        stops: new FeatureSet(),
        outSpatialReference: {
            // autocasts as new SpatialReference()
            wkid: 3857
        },
        startTime: 0,
        returnDirections: true
    });

    var routeTTAPI = {
        url: "https://api.traveltimeapp.com/v4/routes",
    };
    var routeTTAPIParam = {
        headers : {
            "Host": "api.traveltimeapp.com",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Application-Id": "118cbc38",
            "X-Api-Key": "2e338f2d5171f25ed1a497f5eab24ec2"
        },
        method: "post",
        responseType: "json",
        body : "{}"
    };

    srcSearchWidget.on("search-start", function (event) {
        mapView.graphics.remove(srcGraphic);
    });
    srcSearchWidget.on("search-clear", function (event) {
        mapView.graphics.remove(srcGraphic);
    });
    srcSearchWidget.on("search-complete", function (event) {
        if (event.numResults > 0) {
            srcGraphic = event.results[0].results[0].feature;
            srcGraphic.symbol = srcMarkerSymbol;
            mapView.graphics.add(srcGraphic);
            computeRoute();
        }
    });
    srcSearchWidget.on("search-focus", function (event) {
        srcDropPinActive = true;
    });

    dstSearchWidget.on("search-start", function (event) {
        mapView.graphics.remove(dstGraphic);
    });
    dstSearchWidget.on("search-clear", function (event) {
        mapView.graphics.remove(dstGraphic);
    });
    dstSearchWidget.on("search-complete", function (event) {
        if (event.numResults > 0) {
            dstGraphic = event.results[0].results[0].feature;
            dstGraphic.symbol = dstMarkerSymbol;
            mapView.graphics.add(dstGraphic);
            computeRoute();
        }
    });
    dstSearchWidget.on("search-focus", function (event) {
        dstDropPinActive = true;
    });

//----------------------------------------------------------------------
    //FEATURE 1: Route
    function computeRoute() {
        routeLayer.graphics.removeAll();
        if (srcGraphic && dstGraphic) {
            routeParams.stops.features.pop();
            routeParams.stops.features.pop();
            routeParams.stops.features.push(srcGraphic);
            routeParams.stops.features.push(dstGraphic);

            computeSingleRouteTTAPI();
            routeParams.startTime = new Date();
            routeTask.solve(routeParams).then(showRoute);
        }
    }

    function computeSingleRouteTTAPI() {
        routeTTAPIParam.body = JSON.stringify({
            "locations": [
                {
                    "id": "src",
                    "coords": {
                        "lat": srcGraphic.geometry.latitude,
                        "lng": srcGraphic.geometry.longitude
                    }
                },
                {
                    "id": "dst",
                    "coords": {
                        "lat": dstGraphic.geometry.latitude,
                        "lng": dstGraphic.geometry.longitude
                    }
                },
            ],
            "departure_searches": [{
                "id": "departure search example",
                "departure_location_id": "src",
                "arrival_location_ids": [
                    "dst"
                ],
                "transportation": {
                    "type": "public_transport"
                },
                "departure_time": (new Date()).toISOString(),
                "properties": ["travel_time", "distance", "route"]
            }]
        });
        esriRequest(routeTTAPI.url, routeTTAPIParam).then(function(response){
            var path = [];
            response.data.results[0].locations[0].properties[0].route.parts.forEach(function(part){
                part.coords.forEach(function(coord){
                    path.push([coord.lng, coord.lat]);
                });
            });
            var polyline = {
                type: "polyline", // autocasts as new Polyline()
                paths: path
            };
            // Create a symbol for drawing the line
            var lineSymbol = {
                type: "simple-line", // autocasts as SimpleLineSymbol()
                color: [226, 119, 40],
                width: 4
            };
            var polylineGraphic = new Graphic({
                geometry: polyline,
                symbol: lineSymbol
            });
            routeLayer.add(polylineGraphic);

            transitTimeSingle = response.data.results[0].locations[0].properties[0].travel_time/60;
            updateDiffSingle();
        }); //request

    }

    function updateDiffSingle(){
        dojo.byId("timeDiffContainer").innerHTML = Math.round(Math.abs(transitTimeSingle-drivingTimeSingle))+" min";
    }

    function addGraphic(pt) {
        if (srcDropPinActive || dstDropPinActive) {
            var searchWidget = srcDropPinActive ? srcSearchWidget : dstSearchWidget;
            mapView.graphics.remove(srcDropPinActive ? srcGraphic : dstGraphic);
            //routeLayer.graphics.removeAll();

            locatorTask
                .locationToAddress(pt)
                .then(function (response) {
                    // If an address is successfully found, show it in the popup's content
                    //console.log(response.address);
                    searchWidget.searchTerm = response.address;
                })
                .catch(function (error) {
                    // If the promise fails and no result is found, show a generic message
                    console.log("No address was found for this location");
                });

            if (srcDropPinActive) {
                srcGraphic = new Graphic({
                    geometry: pt,
                    symbol: srcMarkerSymbol
                });
                mapView.graphics.add(srcGraphic);
                srcDropPinActive = false;
            } else {
                dstGraphic = new Graphic({
                    geometry: pt,
                    symbol: dstMarkerSymbol
                });
                mapView.graphics.add(dstGraphic);
                dstDropPinActive = false;
            }
        }

        computeRoute();
    }

    // Adds the solved computeRoute to the map as a graphic
    function showRoute(data) {
        var routeResult = data.routeResults[0].route;
        routeResult.symbol = routeSymbol;
        routeLayer.add(routeResult);
        drivingTimeSingle = data.routeResults[0].directions.totalTime;
        updateDiffSingle();
    }

//----------------------------------------------------------------------
    var originSearchWidget = new Search({
        container: "originContainer",
        view: mapView,
        locationEnabled: false,
        autoSelect: false,
        placeholder: "Choose origin point, or click on the map"
    });
    var serviceAreaTask = new ServiceAreaTask({
        url: "https://utility.arcgis.com/usrsvcs/appservices/tbM4mfm4indqaBya/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea"
    });
    // Setup the service area parameters
    var serviceAreaParams = new ServiceAreaParameters({
        defaultBreaks: [15],
        outSpatialReference: map.spatialReference,
        returnFacilities: false,
        facilities: new FeatureSet(),
        timeOfDay: new Date()
    });
    var serviceAreaTTAPI = {
        url: "https://api.traveltimeapp.com/v4/time-map",
    };
    var serviceAreaTTAPIParam = {
        headers : {
            "Host": "api.traveltimeapp.com",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Application-Id": "118cbc38",
            "X-Api-Key": "2e338f2d5171f25ed1a497f5eab24ec2"
        },
        method: "post",
        responseType: "json",
        body : "{}"
    };

    originSearchWidget.on("search-start", function (event) {
        mapView.graphics.removeAll();
    });
    originSearchWidget.on("search-clear", function (event) {
        mapView.graphics.removeAll();
    });
    originSearchWidget.on("search-complete", function (event) {
        if (event.numResults > 0) {
            computeServiceArea(event.results[0].results[0].feature.geometry);
        }
    });
    // originSearchWidget.on("search-focus", function (event) {
    //     srcDropPinActive = true;
    // });


//----------------------------------------------------------------------
    //FEATURE 2: Compute Service Areas
    function computeServiceAreaTTAPI(pt) {
        serviceAreaTTAPIParam.body = JSON.stringify({
            "departure_searches": [
                {
                    "id": "origin",
                    "coords": {
                        "lat": pt.y,
                        "lng": pt.x
                    },
                    "transportation": {
                        "type": "public_transport"
                        //"walking_time":0
                    },
                    "departure_time": (new Date()).toISOString(),
                    "travel_time": parseInt(query("#selectTravelTime").attr('value')[0])*60,
                    // "range": {
                    //     "enabled": true,
                    //     "width": 3600
                    // }
                }
            ]})
        esriRequest(serviceAreaTTAPI.url, serviceAreaTTAPIParam).then(function(response){
            // The requested data
            response.data.results[0].shapes.forEach(function(shape) {
                var ring = [];
                shape.shell.forEach(function (element) {
                    //console.log(element);
                    ring.push([element.lng, element.lat]);
                });

                var polygon = {
                    type: "polygon", // autocasts as new Polygon()
                    rings: ring
                };
                var fillSymbol = {
                    type: "simple-fill", // autocasts as new SimpleFillSymbol()
                    //color: [227, 139, 79, 0.8],
                    color: [226, 119, 40, 0.9],
                    outline: {
                        // autocasts as new SimpleLineSymbol()
                        color: [255, 255, 255],
                        width: 1
                    }
                };

                // Add the geometry and symbol to a new graphic
                var polygonGraphic = new Graphic({
                    geometry: polygon,
                    symbol: fillSymbol
                });
                routeLayer.add(polygonGraphic);
            });
        });
    }
    function computeServiceArea(pt) {
        var mp = webMercatorUtils.webMercatorToGeographic(pt);
        computeServiceAreaTTAPI(mp);

        mapView.graphics.removeAll();
        routeLayer.graphics.removeAll();

        var originGraphic = new Graphic({
            geometry: pt,
            symbol: srcMarkerSymbol
        });
        mapView.graphics.add(originGraphic);

        serviceAreaParams.defaultBreaks = [parseInt(query("#selectTravelTime").attr('value')[0])];
        serviceAreaParams.timeOfDay = new Date();

        serviceAreaParams.facilities.features.pop();
        serviceAreaParams.facilities.features.push(originGraphic);
        serviceAreaTask.solve(serviceAreaParams).then(showServiceArea);
    }

    function showServiceArea(solveResult) {
        var polygonSymbol = {
            type: "simple-fill",  // autocasts as new SimpleFillSymbol()
            //color: [232, 104, 80, 0.25],
            color: [255, 255, 255, 0.2],
            style: "solid",
            outline: {  // autocasts as new SimpleLineSymbol()
                color: "white",
                width: 2
            }
        };
        var sa = solveResult.serviceAreaPolygons[0];
        sa.symbol = polygonSymbol;
        routeLayer.add(sa);
    }

    var neighborSearchWidget = new Search({
        container: "neighborSearchContainer",
        view: mapView,
        locationEnabled: false,
        autoSelect: false,
        placeholder: "Choose origin point, or click on the map"
    });


    neighborSearchWidget.on("search-start", function (event) {
        mapView.graphics.removeAll();
    });
    neighborSearchWidget.on("search-clear", function (event) {
        mapView.graphics.removeAll();
    });
    neighborSearchWidget.on("search-complete", function (event) {
        if (event.numResults > 0) {
            diffODMatrix(event.results[0].results[0].feature.geometry);
        }
    });

    function computeRouteTTAPI(pt) {
        var mp = webMercatorUtils.webMercatorToGeographic(pt);
        var outSpatialReference = {
            wkid: 4326
        };
        projection.load().then(function() {
            var projectedPoints = projection.project(polyCentroids, outSpatialReference);
            projectedPoints.forEach(function(poly, i) {
                routeTTAPIParam.body = JSON.stringify({
                    "locations": [
                        {
                            "id": "src",
                            "coords": {
                                "lat": poly.y,
                                "lng": poly.x
                            }
                        },
                        {
                            "id": "dst",
                            "coords": {
                                "lat": mp.y,
                                "lng": mp.x
                            }
                        },
                    ],
                    "departure_searches": [{
                        "id": "departure search example",
                        "departure_location_id": "src",
                        "arrival_location_ids": [
                            "dst"
                        ],
                        "transportation": {
                            "type": "public_transport"
                        },
                        "departure_time": (new Date()).toISOString(),
                        "properties": ["travel_time", "distance", "computeRoute"]
                    }]
                });
                esriRequest(routeTTAPI.url, routeTTAPIParam).then(function(response){
                    //console.log(response.data.results[0].locations[0].properties[0].travel_time/60);

                    transitTimeArray[i] = response.data.results[0].locations[0].properties[0].travel_time/60;
                    updateDiff();
                }); //request
            }); //foreach
        }); //load

    }


//----------------------------------------------------------------------
    //FEATURE 3: Accessibility
    function ODMatrix(pt) {
        mapView.graphics.removeAll();
        routeLayer.graphics.removeAll();

        transitTimeArray = new Array(polyCentroids.length).fill(120);
        drivingTimeArray = new Array(polyCentroids.length).fill(120);
        diffTimeArray = new Array(polyCentroids.length).fill(120);

        dstGraphic = new Graphic({
            geometry: pt,
            symbol: dstMarkerSymbol
        });
        mapView.graphics.add(dstGraphic);

        polyCentroids.forEach(function(poly, i) {
            srcGraphic = new Graphic({
                geometry: poly,
                symbol: srcMarkerSymbol
            });
            mapView.graphics.add(srcGraphic);
            routeParams.stops.features.pop();
            routeParams.stops.features.pop();
            routeParams.stops.features.push(srcGraphic);
            routeParams.stops.features.push(dstGraphic);

            routeParams.startTime = new Date();
            routeTask.solve(routeParams).then(function(results){
                console.log(results.routeResults[0].directions.totalTime);
                drivingTimeArray[i] = results.routeResults[0].directions.totalTime;
                updateDiff();
            });
        });

    }


    function diffODMatrix(pt) {
        mapView.graphics.removeAll();
        routeLayer.graphics.removeAll();

        transitTimeArray = new Array(polyCentroids.length).fill(120);
        drivingTimeArray = new Array(polyCentroids.length).fill(120);
        diffTimeArray = new Array(polyCentroids.length).fill(120);

        var mp = webMercatorUtils.webMercatorToGeographic(pt);
        var outSpatialReference = {
            wkid: 4326
        };

        dstGraphic = new Graphic({
            geometry: mp,
            symbol: dstMarkerSymbol
        });
        mapView.graphics.add(dstGraphic);

        apiRequestLimitCount = 10;
        apiRequestLimitTime = 60000;
        var outSpatialReference = {
            wkid: 4326
        };
        // projects an array of points
        projection.load().then(function() {
            var projectedPoints = projection.project(polyCentroids, outSpatialReference);


            projectedPoints.forEach(function(poly, i) {
                routeTTAPIParam.body = JSON.stringify({
                    "locations": [
                        {
                            "id": "src",
                            "coords": {
                                "lat": poly.y,
                                "lng": poly.x
                            }
                        },
                        {
                            "id": "dst",
                            "coords": {
                                "lat": mp.y,
                                "lng": mp.x
                            }
                        },
                    ],
                    "departure_searches": [{
                        "id": "departure search example",
                        "departure_location_id": "src",
                        "arrival_location_ids": [
                            "dst"
                        ],
                        "transportation": {
                            "type": "public_transport"
                        },
                        "departure_time": (new Date()).toISOString(),
                        "properties": ["travel_time", "distance", "route"]
                    }]
                });

                //Limit the API calls per minute
                delay = Math.floor(i/apiRequestLimitCount) * apiRequestLimitTime;
                setTimeout( function () {
                    esriRequest(routeTTAPI.url, routeTTAPIParam).then(function (response) {
                        transitTimeArray[i] = response.data.results[0].locations[0].properties[0].travel_time / 60;
                        updateDiff(i);
                    }); //request
                }, delay);


                srcGraphic = new Graphic({
                    geometry: poly,
                    symbol: srcMarkerSymbol
                });
                mapView.graphics.add(srcGraphic);
                routeParams.stops.features.pop();
                routeParams.stops.features.pop();
                routeParams.stops.features.push(srcGraphic);
                routeParams.stops.features.push(dstGraphic);

                routeParams.startTime = new Date();
                routeTask.solve(routeParams).then(function(results){
                    drivingTimeArray[i] = results.routeResults[0].directions.totalTime;
                    updateDiff(i);
                });

            }); //foreach
        }); //load
    }

    var colorPalette = [[222,45,38,0.6],[252,146,114,0.6],[254,224,210,0.6],[255, 255, 255, 0.6]];
    function updateDiff(i) {
        diffTimeArray[i] = Math.abs(transitTimeArray[i] - drivingTimeArray[i]);
        neighborhoodLayer.queryFeatures().then(function(results){
            // prints an array of all the features in the service to the console
            var feature = results.features[i];
            var fillSymbol = {
                type: "simple-fill", // autocasts as new SimpleFillSymbol()
                //color: [255, 255, (diffTimeArray[i]/120.0)*255.0, 0.6],
                color: colorPalette[Math.round(diffTimeArray[i]/40)]
            };

            // Add the geometry and symbol to a new graphic
            var polygonGraphic = new Graphic({
                geometry: feature.geometry,
                symbol: fillSymbol
            });
            routeLayer.add(polygonGraphic);
        });
    }

});