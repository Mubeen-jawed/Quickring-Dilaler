const keys = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export default function DialPad({ onDial }) {
  return (
    <div className="dialpad">
      {keys.map(({ digit, letters }) => (
        <button
          key={digit}
          className="dialpad-key"
          onClick={() => onDial(digit)}
        >
          <span className="key-digit">{digit}</span>
          {letters && <span className="key-letters">{letters}</span>}
        </button>
      ))}
    </div>
  );
}
