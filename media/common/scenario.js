


app.scenarios.styleMap = new OpenLayers.StyleMap({
  "default": new OpenLayers.Style({
    fillColor: "${getColor}",
    fillOpacity: 0.8,
    strokeWidth: 1,
    strokeOpacity: 0.6,
    
  }, {
    // Rules go here.
    context: {
      
      getColor: function(feature) {
        return feature.attributes.color? feature.attributes.color: "#ccc";
      }
    }
  }),
  "select": {
    fillColor: "#8aeeef",
    strokeColor: "#32a8a9"
  }
});


function scenarioFormViewModel() {
  var self = this;
  var colors = ['#ADD071', '#6AC247', '#339936', '#267373', '#349D7F', '#449FC1', '#6A86CD', '#7971D0', '#AB81D5', '#C79FDF', '#EBC6EC', '#D2A379', '#CCC266'];

  self.prescriptionList = ko.observableArray([
    {
        name: "Grow Only",
        description: "No logging activity.",
        color: colors.pop()
    },
    {
      name: "Mixed-species, 75 year rotation, commercial thin",
      description: "75-year rotation with commercial thinning.",
      color: colors.pop()
    }, {
      name: "Monoculture, 40 year rotation, pre-commercial",
      description: "Even-aged management for timber. 40-year rotation clear cut.",
      color: colors.pop()
    }


  ]);

  self.newRx = ko.observable(false);
  self.selectedRx = ko.observable();

  self.addNewRx = function () {
    self.newRx(true);
    decision(function (rx) {
      self.newRx(false);
      self.selectedRx({
        name: ko.observable(),
        description: ko.observable(),
        id: rx,
        color: colors.pop()
      });
    });
  }

  self.saveRx = function () {
    self.prescriptionList.unshift(self.selectedRx());
    self.selectedRx(false);
  };

  self.applyRx = function() {
    var rx = this;

    $.each(app.stand_layer.selectedFeatures, function (i, feature) {
      feature.attributes.color = rx.color;
    });
    app.stand_layer.selectFeature.unselectAll();
  };


  self.selectedFeatures = ko.observable(false);

  // sometimes this happens too fast :()
  setTimeout(function () {
    app.stand_layer.selectFeature.onSelect = function(feature) {
      if (app.stand_layer.selectedFeatures.length > 0) {
        self.selectedFeatures(true);
      }
    };
    app.stand_layer.selectFeature.onUnselect = function(feature) {

      if (app.stand_layer.selectedFeatures.length === 0) {
        self.selectedFeatures(false);
      }
    };
  
  }, 300);
  

  return self;
};

function scenarioViewModel() {
  var self = this;

  self.showScenarioPanels = ko.observable(true);
  self.showScenarioList = ko.observable(false);
  self.scenarioList = ko.observableArray();
  self.selectedFeatures = ko.observableArray();
  self.activeScenario = ko.observable();

  self.scenarioForm = null;

  self.reloadScenarios = function(property) {
    // why is this here? 
    self.loadScenarios(property);
  };

  self.loadScenarios = function(property) {
    self.property = property;

    // update breadcrumbs
    app.breadCrumbs.breadcrumbs.removeAll();
    app.breadCrumbs.breadcrumbs.push({
      name: 'Properties',
      url: '/properties',
      action: self.cancelManageScenarios
    });
    app.breadCrumbs.breadcrumbs.push({
      url: 'scenarios/' + property.id(),
      name: property.name() + ' Scenarios',
      action: null
    });
    app.updateUrl();

    self.showScenarioList(true);
    self.toggleScenarioForm(false);

    map.zoomToExtent(property.bbox());
    var process = function(data) {
      self.scenarioList(data);
      if (data[0]) {
        self.selectedFeatures.push(data[0]); // select the first one
      }
      refreshCharts();
    };
    $.get('/features/forestproperty/links/property-scenarios/{property_id}/'.replace('{property_id}', property.uid()), process);
  };

  self.initialize = function(property) {
    // bind the viewmodel
    ko.applyBindings(self, document.getElementById('scenario-html'));
    ko.applyBindings(self, document.getElementById('scenario-outputs'));
    self.loadScenarios(property);
  };

  self.cancelManageScenarios = function() {
    app.breadCrumbs.breadcrumbs.pop();
    app.updateUrl();
    self.showScenarioPanels(false);
    app.properties.viewModel.showPropertyPanels(true);
    app.property_layer.setOpacity(1);
    if (app.stand_layer)
        app.stand_layer.removeAllFeatures();
    $('#scenario-form-metacontainer').hide();
    $('#searchbox-container').show();
    $('#map').fadeIn();
  };

  self.toggleFeature = function(f) {
    var removed = self.selectedFeatures.remove(f);
    if (removed.length === 0) { // add it
      self.selectedFeatures.push(f);
    }
    refreshCharts();
  };

  self.showDeleteDialog = function(f) {
    self.activeScenario(f);
    $("#scenario-delete-dialog").modal("show");
  };

  self.deleteFeature = function() {
    var url = "/features/generic-links/links/delete/trees_scenario_{pk}/".replace("{pk}", self.activeScenario().pk);
    $.ajax({
      url: url,
      type: "DELETE",
      success: function(data, textStatus, jqXHR) {
        self.selectedFeatures.remove(self.activeScenario());
        self.scenarioList.remove(self.activeScenario());
        refreshCharts();
      },
      complete: function() {
        self.activeScenario(null);
        $("#scenario-delete-dialog").modal("hide");
      }
    });
  };

  self.editFeature = function(f) {
    self.activeScenario(f);
    self.addScenarioStart(true);
  };

  self.newScenarioStart = function() {
    self.activeScenario(null);
    self.addScenarioStart(false);
  };


  self.toggleScenarioForm = function(stat) {
    // self.showScenarioForm(stat);
    if (stat) {
      $("div#scenario-form-metacontainer").show();
      $("#scenario-outputs").hide();
      $("#map").show();


      //$("div.outermap").hide();
    } else {
      $("div#scenario-form-metacontainer").hide();
      $("#scenario-outputs").show();
      $("#map").hide();
      if (app.stand_layer) {
        app.stand_layer.selectFeature.unselectAll();
        app.stand_layer.removeAllFeatures();
        app.selectFeature.activate();
      }


      //$("div.outermap").show();
    }
  };

  self.test = function() {
    alert("test works");
  };

  self.addScenarioStart = function(edit_mode) {
    self.showScenarioList(false);
    self.toggleScenarioForm(true);
    // TODO get formUrl from workspace
    if (self.activeScenario() && edit_mode) {
      formUrl = "/features/scenario/trees_scenario_{pk}/form/".replace('{pk}', self.activeScenario().pk);
      postUrl = formUrl.replace("/form", "");
    } else {
      formUrl = "/features/scenario/form/";
      postUrl = formUrl;
    }

    $.get('/features/forestproperty/links/property-stands-geojson/{property_id}/'.replace('{property_id}', self.property.uid()), function(data) {

      if (app.stand_layer) {
        app.stand_layer.removeAllFeatures();

      } else {

        
        app.stand_layer = new OpenLayers.Layer.Vector("Stands", {
          styleMap: app.scenarios.styleMap,
          renderers: app.renderer
        });


        map.addLayer(app.stand_layer);

        app.stand_layer.selectFeature = new OpenLayers.Control.SelectFeature(app.stand_layer, {
          "clickout": false,
          "multiple": true,
          "toggle": true
        });

        // reenable click and drag in vectors
        app.stand_layer.selectFeature.handlers.feature.stopDown = false;

        map.addControl(app.stand_layer.selectFeature);

      }



      app.stand_layer.addFeatures(app.geojson_format.read(data));

      // deactivate the property control
      app.selectFeature.deactivate();
      app.stand_layer.selectFeature.activate();



    });

    $.ajax({
      url: formUrl,
      type: "GET",
      success: function(data, textStatus, jqXHR) {
        $('#scenario-form-container').html(data);

        
        $('#scenario-form-container').find('button.cancel').click(function(e) {
          e.preventDefault();
          self.showScenarioList(true);
          self.toggleScenarioForm(false);
          $("form#scenario-form").empty();
        });
        $('#scenario-form-container').find('button.submit').click(function(e) {
          e.preventDefault();
          $("#id_input_property").val(app.properties.viewModel.selectedProperty().id());
          var postData = $("form#scenario-form").serialize();
          $.ajax({
            url: postUrl,
            type: "POST",
            data: postData,
            dataType: "json",
            success: function(data, textStatus, jqXHR) {
              var uid = data["X-Madrona-Select"];
              self.selectedFeatures.removeAll();
              self.loadScenarios(self.property);
              self.toggleScenarioForm(false);
            },
            error: function(jqXHR, textStatus, errorThrown) {
              alert(errorThrown);
            }
          });
        });
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert(errorThrown);
      }
    }).done(function () {
      ko.applyBindings(new scenarioFormViewModel(), document.getElementById('scenario-form-container'));
    });
  };

  return self;
}
