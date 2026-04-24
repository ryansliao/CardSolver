import { InfoQuoteBox } from '../../../../components/InfoPopover'

interface Props {
  anchorEl: HTMLElement | null
  onClose: () => void
}

export function MethodologyInfoPopover({ anchorEl, onClose }: Props) {
  return (
    <InfoQuoteBox anchorEl={anchorEl} title="How the Roadmap Is Calculated" onClose={onClose}>
      <p>
        The roadmap turns your cards, spending, and time horizon into the
        rewards, credits, fees, and Effective Annual Fee shown in the
        summary and timeline.
      </p>
      <div>
        <p className="text-slate-300 font-medium mb-1">How spend is assigned</p>
        <p>
          Each dollar of spend goes to the card that earns the most on
          it — no double-counting across cards. If two cards tie, the
          dollars are split evenly.
        </p>
      </div>
      <div>
        <p className="text-slate-300 font-medium mb-1">Time periods</p>
        <p>
          Cards only count during the periods they're active. When cards
          have start or close dates, the projection is split into chunks
          at every card open, close, sign-up-bonus earn, and cap reset,
          and each chunk uses only the cards active then.
        </p>
      </div>
      <div>
        <p className="text-slate-300 font-medium mb-1">Sign-up bonuses</p>
        <p>
          Sign-up bonus minimums are tracked against their deadlines,
          and priority spend is steered to cards with an active offer.
          The lost value from diverting that spend away from your
          best-earning card is deducted.
        </p>
      </div>
      <div>
        <p className="text-slate-300 font-medium mb-1">Fees, credits, and perks</p>
        <p>
          Annual fees, statement credits, first-year fee waivers, and
          one-time perks all get netted in. One-time perks are spread
          evenly across the projection years.
        </p>
      </div>
      <div>
        <p className="text-slate-300 font-medium mb-1">Foreign spend and point upgrades</p>
        <p>
          Foreign-transaction rules split eligible categories into
          domestic and foreign portions, favoring no-fee Visa/Mastercard
          cards abroad. Point-upgrade pairings (e.g. Freedom + Sapphire)
          boost the value of cards whose points become worth more when
          paired with a premium card in the wallet.
        </p>
      </div>
      <p>
        For more detail on any of the numbers, click the ⓘ next to the
        stat you're curious about.
      </p>
    </InfoQuoteBox>
  )
}
