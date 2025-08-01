import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { formatChainIdToCaip } from '@metamask/bridge-controller';

import { MetaMetricsContext } from '../../../contexts/metametrics';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { getCurrentChainId } from '../../../../shared/modules/selectors/networks';
import {
  getHardwareWalletType,
  getAccountTypeForKeyring,
  getPinnedAccountsList,
  getHiddenAccountsList,
  getIsMultichainAccountsState1Enabled,
} from '../../../selectors';

import { MenuItem } from '../../ui/menu';
import {
  IconName,
  ModalFocus,
  Popover,
  PopoverPosition,
  PopoverRole,
  Text,
} from '../../component-library';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventName,
} from '../../../../shared/constants/metametrics';
import {
  showModal,
  updateAccountsList,
  updateHiddenAccountsList,
} from '../../../store/actions';
import { TextVariant } from '../../../helpers/constants/design-system';
import { formatAccountType } from '../../../helpers/utils/metrics';
import { AccountDetailsMenuItem, ViewExplorerMenuItem } from '../menu-items';
import { getHDEntropyIndex } from '../../../selectors/selectors';

const METRICS_LOCATION = 'Account Options';

export const AccountListItemMenu = ({
  anchorElement,
  onClose,
  closeMenu,
  isRemovable,
  account,
  isOpen,
  isPinned,
  isHidden,
}) => {
  const t = useI18nContext();
  const trackEvent = useContext(MetaMetricsContext);
  const hdEntropyIndex = useSelector(getHDEntropyIndex);
  const dispatch = useDispatch();

  const chainId = useSelector(getCurrentChainId);

  const deviceName = useSelector(getHardwareWalletType);

  const isMultichainAccountsState1Enabled = useSelector(
    getIsMultichainAccountsState1Enabled,
  );

  const { keyring } = account.metadata;
  const accountType = formatAccountType(getAccountTypeForKeyring(keyring));

  const pinnedAccountList = useSelector(getPinnedAccountsList);
  const hiddenAccountList = useSelector(getHiddenAccountsList);

  // Handle Tab key press for accessibility inside the popover and will close the popover on the last MenuItem
  const lastItemRef = useRef(null);
  const accountDetailsItemRef = useRef(null);
  const removeAccountItemRef = useRef(null);
  const removeJWTItemRef = useRef(null);

  // Checks the MenuItems from the bottom to top to set lastItemRef on the last MenuItem that is not disabled
  useEffect(() => {
    if (removeJWTItemRef.current) {
      lastItemRef.current = removeJWTItemRef.current;
    } else if (removeAccountItemRef.current) {
      lastItemRef.current = removeAccountItemRef.current;
    } else {
      lastItemRef.current = accountDetailsItemRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    removeJWTItemRef.current,
    removeAccountItemRef.current,
    accountDetailsItemRef.current,
  ]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Tab' && event.target === lastItemRef.current) {
        // If Tab is pressed at the last item to close popover and focus to next element in DOM
        onClose();
      }
    },
    [onClose],
  );

  // Handle click outside of the popover to close it
  const popoverDialogRef = useRef(null);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        popoverDialogRef?.current &&
        !popoverDialogRef.current.contains(event.target)
      ) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  const handlePinning = (address) => {
    const updatedPinnedAccountList = [...pinnedAccountList, address];
    dispatch(updateAccountsList(updatedPinnedAccountList));
  };

  const handleUnpinning = (address) => {
    const updatedPinnedAccountList = pinnedAccountList.filter(
      (item) => item !== address,
    );
    dispatch(updateAccountsList(updatedPinnedAccountList));
  };

  const handleHidding = (address) => {
    // If the account is already hidden, we do not add it again
    // TODO: The controller should handle this logic
    if (hiddenAccountList.includes(address)) {
      return;
    }

    const updatedHiddenAccountList = [...hiddenAccountList, address];
    if (pinnedAccountList.includes(address)) {
      handleUnpinning(address);
    }
    dispatch(updateHiddenAccountsList(updatedHiddenAccountList));
  };

  const handleUnhidding = (address) => {
    const updatedHiddenAccountList = hiddenAccountList.filter(
      (item) => item !== address,
    );
    dispatch(updateHiddenAccountsList(updatedHiddenAccountList));
  };

  return (
    <Popover
      className="multichain-account-list-item-menu__popover"
      referenceElement={anchorElement}
      role={PopoverRole.Dialog}
      position={PopoverPosition.Bottom}
      offset={[0, 0]}
      padding={0}
      isOpen={isOpen}
      isPortal
      preventOverflow
      flip
    >
      <ModalFocus restoreFocus initialFocusRef={anchorElement}>
        <div onKeyDown={handleKeyDown} ref={popoverDialogRef}>
          <AccountDetailsMenuItem
            metricsLocation={METRICS_LOCATION}
            closeMenu={closeMenu}
            address={account.address}
            textProps={{ variant: TextVariant.bodySm }}
          />
          <ViewExplorerMenuItem
            metricsLocation={METRICS_LOCATION}
            closeMenu={closeMenu}
            textProps={{ variant: TextVariant.bodySm }}
            account={account}
          />
          {isHidden ? null : (
            <MenuItem
              data-testid="account-list-menu-pin"
              onClick={() => {
                isPinned
                  ? handleUnpinning(account.address)
                  : handlePinning(account.address);
                onClose();
              }}
              iconName={isPinned ? IconName.Unpin : IconName.Pin}
            >
              <Text variant={TextVariant.bodySm}>
                {isPinned ? t('unpin') : t('pinToTop')}
              </Text>
            </MenuItem>
          )}
          <MenuItem
            data-testid="account-list-menu-hide"
            onClick={() => {
              isHidden
                ? handleUnhidding(account.address)
                : handleHidding(account.address);
              onClose();
            }}
            iconName={isHidden ? IconName.Eye : IconName.EyeSlash}
          >
            <Text variant={TextVariant.bodySm}>
              {isHidden ? t('showAccount') : t('hideAccount')}
            </Text>
          </MenuItem>
          {isRemovable && !isMultichainAccountsState1Enabled ? (
            <MenuItem
              ref={removeAccountItemRef}
              data-testid="account-list-menu-remove"
              onClick={() => {
                dispatch(
                  showModal({
                    name: 'CONFIRM_REMOVE_ACCOUNT',
                    account,
                  }),
                );
                trackEvent({
                  event: MetaMetricsEventName.AccountRemoved,
                  category: MetaMetricsEventCategory.Accounts,
                  properties: {
                    account_hardware_type: deviceName,
                    chain_id: chainId,
                    account_type: accountType,
                    hd_entropy_index: hdEntropyIndex,
                    caip_chain_id: formatChainIdToCaip(chainId),
                  },
                });
                onClose();
                closeMenu?.();
              }}
              iconName={IconName.Trash}
            >
              <Text variant={TextVariant.bodySm}>{t('removeAccount')}</Text>
            </MenuItem>
          ) : null}
        </div>
      </ModalFocus>
    </Popover>
  );
};

AccountListItemMenu.propTypes = {
  /**
   * Element that the menu should display next to
   */
  anchorElement: PropTypes.instanceOf(window.Element),
  /**
   * Function that executes when the menu is closed
   */
  onClose: PropTypes.func.isRequired,
  /**
   * Represents if the menu is open or not
   *
   * @type {boolean}
   */
  isOpen: PropTypes.bool.isRequired,
  /**
   * Function that closes the menu
   */
  closeMenu: PropTypes.func,
  /**
   * Represents if the account should be removable
   */
  isRemovable: PropTypes.bool.isRequired,
  /**
   * Represents pinned accounts
   */
  isPinned: PropTypes.bool,
  /**
   * Represents hidden accounts
   */
  isHidden: PropTypes.bool,
  /**
   * An account object that has name, address, and balance data
   */
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    balance: PropTypes.string.isRequired,
    metadata: PropTypes.shape({
      name: PropTypes.string.isRequired,
      snap: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        enabled: PropTypes.bool,
      }),
      keyring: PropTypes.shape({
        type: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }).isRequired,
};
