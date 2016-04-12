///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import config from 'app/core/config';
import {coreModule, appEvents} from 'app/core/core';

var datasourceTypes = [];

var defaults = {
  name: '',
  //  type: 'graphite', 
  type: 'influxdb', // added by shiliang  
  url: '',
  access: 'proxy',
  jsonData: {}
};

export class DataSourceEditCtrl {
  isNew: boolean;
  datasources: any[];
  current: any;
  types: any;
  testing: any;
  datasourceMeta: any;
  tabIndex: number;
  hasDashboards: boolean;
  editForm: any;

  /** @ngInject */
  constructor(
    private $scope,
    private $q,
    private backendSrv,
    private $routeParams,
    private $filter,   // added by shiliang
    private $location,
    private datasourceSrv) {

      this.isNew = true;
      this.datasources = [];
      this.tabIndex = 0;

      this.loadDatasourceTypes().then(() => {
        if (this.$routeParams.id) {
          this.getDatasourceById(this.$routeParams.id);
        } else {
          this.current = angular.copy(defaults);
          this.typeChanged();
        }
      });
    }

    loadDatasourceTypes() {
      if (datasourceTypes.length > 0) {
        this.types = datasourceTypes;
        return this.$q.when(null);
      }

      return this.backendSrv.get('/api/plugins', {enabled: 1, type: 'datasource'}).then(plugins => {
//        added by shiliang
//        datasourceTypes = plugins;
//        this.types = plugins;
        datasourceTypes = this.$filter('filter')(plugins, {id: 'influxdb'});
        this.types = datasourceTypes;
      });
    }

    getDatasourceById(id) {
      this.backendSrv.get('/api/datasources/' + id).then(ds => {
        this.isNew = false;
        this.current = ds;
        return this.typeChanged();
      });
    }

    typeChanged() {
      this.hasDashboards = false;
      return this.backendSrv.get('/api/plugins/' + this.current.type + '/settings').then(pluginInfo => {
        this.datasourceMeta = pluginInfo;
        this.hasDashboards = _.findWhere(pluginInfo.includes, {type: 'dashboard'});
      });
    }

    updateFrontendSettings() {
      return this.backendSrv.get('/api/frontend/settings').then(settings => {
        config.datasources = settings.datasources;
        config.defaultDatasource = settings.defaultDatasource;
        this.datasourceSrv.init();
      });
    }

    testDatasource() {
      this.testing = { done: false };

      this.datasourceSrv.get(this.current.name).then(datasource => {
        if (!datasource.testDatasource) {
          this.testing.message = 'Data source does not support test connection feature.';
          this.testing.status = 'warning';
          this.testing.title = 'Unknown';
          return;
        }

        return datasource.testDatasource().then(result => {
          this.testing.message = result.message;
          this.testing.status = result.status;
          this.testing.title = result.title;
        }).catch(err => {
          if (err.statusText) {
            this.testing.message = err.statusText;
            this.testing.title = "HTTP Error";
          } else {
            this.testing.message = err.message;
            this.testing.title = "Unknown error";
          }
        });
      }).finally(() => {
        this.testing.done = true;
      });
    }

    saveChanges(test) {
      if (!this.editForm.$valid) {
        return;
      }

      if (this.current.id) {
        return this.backendSrv.put('/api/datasources/' + this.current.id, this.current).then(() => {
          this.updateFrontendSettings().then(() => {
            if (test) {
              this.testDatasource();
            }
          });
        });
      } else {
        return this.backendSrv.post('/api/datasources', this.current).then(result => {
          this.updateFrontendSettings();
          this.$location.path('datasources/edit/' + result.id);
        });
      }
    };

    confirmDelete() {
      this.backendSrv.delete('/api/datasources/' + this.current.id).then(() => {
        this.$location.path('datasources');
      });
    }

    delete(s) {
      appEvents.emit('confirm-modal', {
        title: 'Delete',
        text: 'Are you sure you want to delete this datasource?',
        yesText: "Delete",
        icon: "fa-trash",
        onConfirm: () => {
          this.confirmDelete();
        }
      });
    }
}

coreModule.controller('DataSourceEditCtrl', DataSourceEditCtrl);

coreModule.directive('datasourceHttpSettings', function() {
  return {
    scope: {current: "="},
    templateUrl: 'public/app/features/plugins/partials/ds_http_settings.html'
  };
});