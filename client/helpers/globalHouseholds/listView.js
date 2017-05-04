/**
 * Created by Anush-PC on 7/19/2016.
 */

import { GlobalHouseholds } from '/imports/api/global-households/global-households';


Template.globalHouseholdListView.helpers(
  {
    hasGlobalHousehold() {
      return GlobalHouseholds.find({}).fetch();
    },
    globalHouseholdTableOptions() {
      // Deep Copy to avoid reference to the same array.
      // It was causing to add Edit/Delete column mulitple times
      let tableColumns = $.extend(true, [], HomeConfig.collections.globalHouseholds.tableColumns);
      let showEditColumn = true;
      let showDeleteColumn = true;
      if (typeof HomeConfig.collections.globalHouseholds.showEditColumn === 'boolean'
          && HomeConfig.collections.globalHouseholds.showEditColumn === false) {
        showEditColumn = false;
      }

      if (typeof HomeConfig.collections.globalHouseholds.showDelColumn === 'boolean'
          && HomeConfig.collections.globalHouseholds.showDelColumn === false) {
        showDeleteColumn = false;
      }

      if (showEditColumn) {
        tableColumns = $.merge(tableColumns, [HomeConfig.appEditButton]);
      }

      if (showDeleteColumn) {
        tableColumns = $.merge(tableColumns, [HomeConfig.appDelButton]);
      }
      return {
        columns: tableColumns,
        dom: HomeConfig.adminTablesDom,
      };
    },
    globalHouseholdData() {
      return () => GlobalHouseholds.find({}).fetch();
    },
  }
);

