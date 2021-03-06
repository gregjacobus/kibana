/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import { EuiFormRow, EuiHorizontalRule, EuiRadio, EuiSelect, htmlIdGenerator } from '@elastic/eui';
import { IndexPatternLayer, IndexPatternField } from '../types';
import { hasField } from '../utils';

const generator = htmlIdGenerator('lens-nesting');

function nestColumn(columnOrder: string[], outer: string, inner: string) {
  const result = columnOrder.filter((c) => c !== inner);
  const outerPosition = result.indexOf(outer);

  result.splice(outerPosition + 1, 0, inner);

  return result;
}

export function BucketNestingEditor({
  columnId,
  layer,
  setColumns,
  fieldMap,
}: {
  columnId: string;
  layer: IndexPatternLayer;
  setColumns: (columns: string[]) => void;
  fieldMap: Record<string, IndexPatternField>;
}) {
  const column = layer.columns[columnId];
  const columns = Object.entries(layer.columns);
  const aggColumns = columns
    .filter(([id, c]) => id !== columnId && c.isBucketed)
    .map(([value, c]) => ({
      value,
      text: c.label,
      fieldName: hasField(c) ? fieldMap[c.sourceField].displayName : '',
    }));

  if (!column || !column.isBucketed || !aggColumns.length) {
    return null;
  }

  const fieldName = hasField(column) ? fieldMap[column.sourceField].displayName : '';

  const prevColumn = layer.columnOrder[layer.columnOrder.indexOf(columnId) - 1];

  if (aggColumns.length === 1) {
    const [target] = aggColumns;

    function toggleNesting() {
      if (prevColumn) {
        setColumns(nestColumn(layer.columnOrder, columnId, target.value));
      } else {
        setColumns(nestColumn(layer.columnOrder, target.value, columnId));
      }
    }

    return (
      <>
        <EuiHorizontalRule margin="m" />
        <EuiFormRow
          label={i18n.translate('xpack.lens.indexPattern.groupingControlLabel', {
            defaultMessage: 'Grouping',
          })}
        >
          <>
            <EuiRadio
              id={generator('topLevel')}
              data-test-subj="indexPattern-nesting-topLevel"
              label={
                column.operationType === 'terms'
                  ? i18n.translate('xpack.lens.indexPattern.groupingOverallTerms', {
                      defaultMessage: 'Overall top {field}',
                      values: { field: fieldName },
                    })
                  : i18n.translate('xpack.lens.indexPattern.groupingOverallDateHistogram', {
                      defaultMessage: 'Top values for each {field}',
                      values: { field: fieldName },
                    })
              }
              checked={!prevColumn}
              onChange={toggleNesting}
            />
            <EuiRadio
              id={generator('bottomLevel')}
              data-test-subj="indexPattern-nesting-bottomLevel"
              label={
                column.operationType === 'terms'
                  ? i18n.translate('xpack.lens.indexPattern.groupingSecondTerms', {
                      defaultMessage: 'Top values for each {target}',
                      values: { target: target.fieldName },
                    })
                  : i18n.translate('xpack.lens.indexPattern.groupingSecondDateHistogram', {
                      defaultMessage: 'Overall top {target}',
                      values: { target: target.fieldName },
                    })
              }
              checked={!!prevColumn}
              onChange={toggleNesting}
            />
          </>
        </EuiFormRow>
      </>
    );
  }

  return (
    <>
      <EuiHorizontalRule margin="m" />
      <EuiFormRow
        label={i18n.translate('xpack.lens.indexPattern.groupByDropdown', {
          defaultMessage: 'Group by',
        })}
        display="rowCompressed"
      >
        <EuiSelect
          compressed
          data-test-subj="indexPattern-nesting-select"
          options={[
            {
              value: '',
              text: i18n.translate('xpack.lens.xyChart.nestUnderRoot', {
                defaultMessage: 'Entire data set',
              }),
            },
            ...aggColumns.map(({ value, text }) => ({ value, text })),
          ]}
          value={prevColumn}
          onChange={(e) => setColumns(nestColumn(layer.columnOrder, e.target.value, columnId))}
        />
      </EuiFormRow>
    </>
  );
}
