from pathlib import Path

from bird_project.application.aggregation_service import AggregationService


def main() -> None:
    summary = AggregationService().summarize_directory(Path("data"))
    print((summary.row_count, summary.column_count))


main()
