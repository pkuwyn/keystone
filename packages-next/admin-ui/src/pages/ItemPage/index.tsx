/* @jsx jsx */

import copyToClipboard from 'clipboard-copy';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, HTMLAttributes, useMemo, useState } from 'react';

import { ListMeta } from '@keystone-next/types';
import { Button } from '@keystone-ui/button';
import { Center, Heading, Stack, jsx, useTheme } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { ClipboardIcon } from '@keystone-ui/icons/icons/ClipboardIcon';
import { ChevronRightIcon } from '@keystone-ui/icons/icons/ChevronRightIcon';
import { AlertDialog, DrawerController } from '@keystone-ui/modals';
import { useToasts } from '@keystone-ui/toast';
import { Tooltip } from '@keystone-ui/tooltip';

import { gql, useMutation, useQuery } from '../../apollo';
import { PageContainer, HEADER_HEIGHT } from '../../components/PageContainer';
import { useList } from '../../context';
import {
  DataGetter,
  DeepNullable,
  makeDataGetter,
  deserializeValue,
  ItemData,
  useInvalidFields,
  Fields,
  useChangedFieldsAndDataForUpdate,
} from '@keystone-next/admin-ui-utils';
import { GraphQLErrorNotice } from '../../components/GraphQLErrorNotice';
import { CreateItemDrawer } from '../../components/CreateItemDrawer';
import { TextInput } from '@keystone-ui/fields';

type ItemPageProps = {
  listKey: string;
};

function ItemForm({
  listKey,
  itemGetter,
  selectedFields,
  fieldModes,
  showDelete,
}: {
  listKey: string;
  itemGetter: DataGetter<ItemData>;
  selectedFields: string;
  fieldModes: Record<string, 'edit' | 'read' | 'hidden'>;
  showDelete: boolean;
}) {
  const list = useList(listKey);

  const [update, { loading, error, data }] = useMutation(
    gql`mutation ($data: ${list.gqlNames.updateInputName}!, $id: ID!) {
      item: ${list.gqlNames.updateMutationName}(id: $id, data: $data) {
        ${selectedFields}
      }
    }`,
    {
      errorPolicy: 'all',
    }
  );
  itemGetter =
    useMemo(() => {
      if (data) {
        return makeDataGetter(data, error?.graphQLErrors).get('item');
      }
    }, [data, error]) ?? itemGetter;

  const [state, setValue] = useState(() => {
    const value = deserializeValue(list.fields, itemGetter);
    return {
      value,
      item: itemGetter.data,
    };
  });
  if (
    !loading &&
    state.item !== itemGetter.data &&
    (itemGetter.errors || []).every(x => x.path?.length !== 1)
  ) {
    const value = deserializeValue(list.fields, itemGetter);
    setValue({
      value,
      item: itemGetter.data,
    });
  }

  const { changedFields, dataForUpdate } = useChangedFieldsAndDataForUpdate(
    list.fields,
    itemGetter,
    state.value
  );

  const invalidFields = useInvalidFields(list.fields, state.value);

  const [forceValidation, setForceValidation] = useState(false);
  const toasts = useToasts();
  const saveButtonProps = {
    isLoading: loading,
    weight: 'bold',
    tone: 'active',
    onClick: () => {
      const newForceValidation = invalidFields.size !== 0;
      setForceValidation(newForceValidation);
      if (newForceValidation) return;

      update({
        variables: {
          data: dataForUpdate,
          id: itemGetter.get('id').data,
        },
      })
        .then(({ data, errors }) => {
          // we're checking for path.length === 1 because errors with a path larger than 1 will be field level errors
          // which are handled seperately and do not indicate a failure to update the item
          const error = errors?.find(x => x.path?.length === 1);
          if (error) {
            toasts.addToast({
              title: 'Failed to update item',
              tone: 'negative',
              message: error.message,
            });
          } else {
            toasts.addToast({
              title: data.item[list.labelField] || data.item.id,
              tone: 'positive',
              message: 'Saved successfully',
            });
          }
        })
        .catch(err => {
          toasts.addToast({
            title: 'Failed to update item',
            tone: 'negative',
            message: err.message,
          });
        });
    },
    children: 'Save Changes',
  } as const;

  return (
    <Fragment>
      <GraphQLErrorNotice
        networkError={error?.networkError}
        // we're checking for path.length === 1 because errors with a path larger than 1 will be field level errors
        // which are handled seperately and do not indicate a failure to update the item
        errors={error?.graphQLErrors.filter(x => x.path?.length === 1)}
      />
      <Fields
        fieldModes={fieldModes}
        fields={list.fields}
        forceValidation={forceValidation}
        invalidFields={invalidFields}
        onChange={value => {
          setValue({
            item: state.item,
            value,
          });
        }}
        value={state.value}
      />
      <Toolbar>
        <Stack across gap="small">
          {changedFields.size ? (
            <Button {...saveButtonProps} />
          ) : (
            <Tooltip content="No fields have been modified so you cannot save changes">
              {props => (
                <Button
                  {...props}
                  {...saveButtonProps}
                  tone="passive"
                  // making onClick undefined instead of making the button disabled so the butto
                  // can be focused, meaning keyboard users can see the tooltip
                  onClick={undefined}
                />
              )}
            </Tooltip>
          )}
          <Button
            weight="none"
            onClick={() => {
              setValue({
                item: itemGetter.data,
                value: deserializeValue(list.fields, itemGetter),
              });
            }}
          >
            Reset changes
          </Button>
        </Stack>
        {showDelete && (
          <DeleteButton
            list={list}
            itemLabel={(itemGetter.data?.[list.labelField] ?? itemGetter.data?.id!) as string}
            itemId={itemGetter.data?.id!}
          />
        )}
      </Toolbar>
    </Fragment>
  );
}

function DeleteButton({
  itemLabel,
  itemId,
  list,
}: {
  itemLabel: string;
  itemId: string;
  list: ListMeta;
}) {
  const toasts = useToasts();
  const [deleteItem, { loading }] = useMutation(
    gql`mutation ($id: ID!) {
      ${list.gqlNames.deleteMutationName}(id: $id) {
        id
      }
    }`,
    { variables: { id: itemId } }
  );
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <Fragment>
      <Button
        tone="negative"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Delete
      </Button>
      <AlertDialog
        // TODO: change the copy in the title and body of the modal
        title="Delete Confirmation"
        isOpen={isOpen}
        tone="negative"
        actions={{
          confirm: {
            label: 'Delete',
            action: async () => {
              await deleteItem().catch(err => {
                toasts.addToast({
                  title: 'Failed to delete item',
                  message: err.message,
                  tone: 'negative',
                });
              });
              router.push(`/${list.path}`);
              toasts.addToast({
                title: itemLabel,
                message: 'Deleted successfully',
                tone: 'positive',
              });
            },
            loading,
          },
          cancel: {
            label: 'Cancel',
            action: () => {
              setIsOpen(false);
            },
          },
        }}
      >
        Are you sure you want to delete <strong>{itemLabel}</strong>?
      </AlertDialog>
    </Fragment>
  );
}

export const ItemPage = ({ listKey }: ItemPageProps) => {
  const router = useRouter();
  const { id } = router.query;
  const list = useList(listKey);
  const { colors, spacing, typography } = useTheme();

  const { query, selectedFields } = useMemo(() => {
    let selectedFields = Object.keys(list.fields)
      .map(fieldPath => {
        return list.fields[fieldPath].controller.graphqlSelection;
      })
      .join('\n');
    return {
      selectedFields,
      query: gql`
        query ItemPage($id: ID!, $listKey: String!) {
          item: ${list.gqlNames.itemQueryName}(where: {id: $id}) {
            ${selectedFields}
          }
          keystone {
            adminMeta {
              list(key: $listKey) {
                hideCreate
                hideDelete
                fields {
                  path
                  itemView(id: $id) {
                    fieldMode
                  }
                }
              }
            }
          }
        }
      `,
    };
  }, [list]);
  let { data, error, loading } = useQuery(query, {
    variables: { id, listKey },
    errorPolicy: 'all',
    skip: id === undefined,
  });
  loading ||= id === undefined;

  const dataGetter = makeDataGetter<
    DeepNullable<{
      item: ItemData;
      keystone: {
        adminMeta: {
          list: {
            fields: {
              path: string;
              itemView: {
                fieldMode: 'edit' | 'read' | 'hidden';
              };
            }[];
          };
        };
      };
    }>
  >(data, error?.graphQLErrors);

  let itemViewFieldModesByField = useMemo(() => {
    let itemViewFieldModesByField: Record<string, 'edit' | 'read' | 'hidden'> = {};
    dataGetter.data?.keystone?.adminMeta?.list?.fields?.forEach(field => {
      if (field !== null && field.path !== null && field?.itemView?.fieldMode != null) {
        itemViewFieldModesByField[field.path] = field.itemView.fieldMode;
      }
    });
    return itemViewFieldModesByField;
  }, [dataGetter.data?.keystone?.adminMeta?.list?.fields]);

  const errorsFromMetaQuery = dataGetter.get('keystone').errors;

  const [createModalState, setModalState] = useState<
    { state: 'closed' } | { state: 'open'; id: string }
  >({
    state: 'closed',
  });

  if (createModalState.state === 'open' && createModalState.id !== id) {
    setModalState({ state: 'closed' });
  }

  const hideCreate = data?.keystone.adminMeta.list.hideCreate;

  return (
    <PageContainer
      header={
        <div
          css={{
            alignItems: 'center',
            display: 'flex',
            flex: 1,
            justifyContent: 'space-between',
            minWidth: 0, // fix flex text truncation
          }}
        >
          <div
            css={{
              alignItems: 'center',
              display: 'flex',
              flex: 1,
              minWidth: 0,
            }}
          >
            <Heading type="h3">
              <Link href={`/${list.path}`} passHref>
                <a css={{ textDecoration: 'none' }}>{list.label}</a>
              </Link>
            </Heading>
            <div css={{ color: colors.foregroundDim }}>
              <ChevronRightIcon />
            </div>
            <Heading
              as="h1"
              type="h3"
              css={{
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                flex: 1,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data && (data.item[list.labelField] || data.item.id)}
            </Heading>
          </div>
          {!hideCreate && (
            <Button
              disabled={createModalState.state === 'open'}
              onClick={() => {
                setModalState({ state: 'open', id: id as string });
              }}
              tone="positive"
              weight="bold"
              css={{ marginLeft: spacing.medium }}
            >
              Create
            </Button>
          )}
        </div>
      }
    >
      <DrawerController isOpen={createModalState.state === 'open'}>
        <CreateItemDrawer
          listKey={listKey}
          onCreate={({ id }) => {
            router.push(`/${list.path}/[id]`, `/${list.path}/${id}`);
            setModalState({ state: 'closed' });
          }}
          onClose={() => {
            setModalState({ state: 'closed' });
          }}
        />
      </DrawerController>
      {loading ? (
        <Center css={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
          <LoadingDots label="Loading item data" size="large" tone="passive" />
        </Center>
      ) : errorsFromMetaQuery ? (
        <div css={{ color: 'red' }}>{errorsFromMetaQuery[0].message}</div>
      ) : (
        <Fragment>
          <div
            css={{
              display: 'flex',
              alignItems: 'center',
              marginTop: spacing.xlarge,
              marginBottom: spacing.xxlarge,
            }}
          >
            <TextInput
              css={{
                marginRight: spacing.medium,
                fontFamily: typography.fontFamily.monospace,
                fontSize: typography.fontSize.small,
              }}
              readOnly
              value={data.item.id}
              size="small"
            />
            <Tooltip content="Copy ID">
              {props => (
                <Button
                  {...props}
                  aria-label="Copy ID"
                  size="small"
                  onClick={() => {
                    copyToClipboard(data.item.id);
                  }}
                >
                  <ClipboardIcon size="small" />
                </Button>
              )}
            </Tooltip>
          </div>
          <ItemForm
            fieldModes={itemViewFieldModesByField}
            selectedFields={selectedFields}
            showDelete={!data.keystone.adminMeta.list!.hideDelete}
            listKey={listKey}
            itemGetter={dataGetter.get('item') as DataGetter<ItemData>}
          />
        </Fragment>
      )}
    </PageContainer>
  );
};

const Toolbar = (props: HTMLAttributes<HTMLDivElement>) => {
  const { colors, spacing } = useTheme();
  return (
    <div
      css={{
        background: colors.background,
        borderTop: `1px solid ${colors.border}`,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: spacing.xlarge,
        paddingBottom: spacing.xlarge,
        paddingTop: spacing.xlarge,
        position: 'sticky',
      }}
      {...props}
    />
  );
};
