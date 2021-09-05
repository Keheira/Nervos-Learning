/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';

import { SimpleStorageWrapper } from '../lib/contracts/SimpleStorageWrapper';

import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { CONFIG } from '../config';
import { AddressTranslator } from 'nervos-godwoken-integration';
import * as ERC20  from '../../build/contracts/ERC201.json';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };
        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<SimpleStorageWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [balance, setBalance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [storedValue, setStoredValue] = useState<number | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);
    const [newStoredNumberInputValue, setNewStoredNumberInputValue] = useState<
        number | undefined
    >();
    const addressTranslator = new AddressTranslator();
    const [txnHash, setHash] = useState<string | undefined>();
    const [polyjuiceAddy, setPolyjuiceAddy] = useState<string | undefined>();
    const [depositAddy, setDepositAddy] = useState<string | undefined>();
    const [balanceSUDT, setBalanceSUDT] = useState<bigint>();

    const SUDT_PROXY_CONTRACT_ADDRESS = `0x3E34C2697282CAB6B238Df1c5807dBb4837fBFfe`;

    useEffect(() => {
        (async () => {
            if (accounts?.[0]){
                setPolyjuiceAddy(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]))

                const l2depositaddy = (await addressTranslator.getLayer2DepositAddress(web3, accounts?.[0])).addressString
                setDepositAddy(l2depositaddy)
            } else {
                setPolyjuiceAddy(undefined)
            }
        })();
    }, [accounts?.[0]])

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    async function deployContract() {
        const _contract = new SimpleStorageWrapper(web3);

        try {
            setHash(undefined);
            setTransactionInProgress(true);

            const deployHash = await _contract.deploy(account);

            setHash(deployHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast('There was an error sending your transaction. Please check developer console.');
        } finally {
            setTransactionInProgress(false);
        }
    }

    async function getStoredValue() {
        const value = await contract.getStoredValue(account);
        toast('Successfully read latest stored value.', { type: 'success' });

        setStoredValue(value);
    }

    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new SimpleStorageWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        setContract(_contract);
        setStoredValue(undefined);
    }

    async function setNewStoredValue() {
        try {
            setTransactionInProgress(true);
            const number = Math.floor(Math.random() * (10 + 1));
            await contract.setStoredValue(number, account);
            toast(
                'Successfully set latest stored value. You can refresh the read value now manually.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast('There was an error sending your transaction. Please check developer console.');
        } finally {
            setTransactionInProgress(false);
        }
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setBalance(_l2Balance);

                const poly = addressTranslator.ethAddressToGodwokenShortAddress(_accounts[0])
                // console.log(poly)
                const contractSUDT = new _web3.eth.Contract(ERC20.abi as never, SUDT_PROXY_CONTRACT_ADDRESS)
                // console.log(contractSUDT)
                const contractBalance = BigInt(await contractSUDT.methods.balanceOf(poly).call({
                    from: _accounts[0]
                }))
                // console.log(contractBalance)
                setBalanceSUDT(contractBalance)
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div>
            ETH address: <b>{accounts?.[0]}</b>
            <br />
            Polyjuice address: <b>{polyjuiceAddy}</b>
            <br />
            L2 Deposit address: <b>{depositAddy}</b>
            <br />
            <a href={`https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos?xchain-asset=0x0000000000000000000000000000000000000000`} target="_blank">
                Go here with your L2 deposit address
            </a>
            Balance of the wealthy local: <b>{balance ? (balance / 10n ** 8n).toString() : <LoadingIndicator />} ETH</b>
            <br />
            SUDT balance of the wealthy local: <b>{balanceSUDT ? Number(balanceSUDT).toFixed(9).toString() : <LoadingIndicator />} ckETH</b>
            <br />
            <br />
            Contract address: <b>{contract?.address || '-'}</b> <br />
            Txn hash: <b>{txnHash || '-'}</b> <br />
            <br />
            <hr />
            <p>
                Hola! This is my first time writing a dApp. Kinda excitign right? Crazy way to learn but this
                ports the og ETH dApp to Polyjuice. S/o to Nervos for the hackathon and this cool thing that 
                I will not brag about forever.
            </p>
            <button onClick={deployContract} disabled={!balance}>
                Deploy contract
            </button>
            &nbsp;or&nbsp;
            <input
                placeholder="Existing contract id"
                onChange={e => setExistingContractIdInputValue(e.target.value)}
            />
            <button
                disabled={!existingContractIdInputValue || !balance}
                onClick={() => setExistingContractAddress(existingContractIdInputValue)}
            >
                Use existing contract
            </button>
            <br />
            <br />
            <button onClick={setNewStoredValue} disabled={!contract}>
                Set random stored value
            </button>
            <br />
            {storedValue ? <>&nbsp;&nbsp;Stored value: {storedValue.toString()}</> : null}
            <br />
            <br />
            <hr />
            <ToastContainer />
        </div>
    );
}
