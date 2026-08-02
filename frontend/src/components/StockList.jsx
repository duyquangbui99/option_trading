import StockCard from "./StockCard";

export default function StockList({ stocks, histories, selectedSymbol, onSelect, onRemove }) {
  if (stocks.length === 0) {
    return <p className="empty-state">No stocks yet — add one above to get started.</p>;
  }

  return (
    <div className="list" role="listbox" aria-label="Watchlist">
      {stocks.map((stock) => (
        <StockCard
          key={stock.symbol}
          stock={stock}
          history={histories[stock.symbol]}
          selected={stock.symbol === selectedSymbol}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
